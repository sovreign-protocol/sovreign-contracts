// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.7.6;

import "../interfaces/InterestStrategyInterface.sol";
import "../libraries/LibRewardsDistribution.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//Describes a cubic parabola
contract InterestStrategy is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    // timestamp for the epoch 1
    // everything before that is considered epoch 0 which won't have a reward but allows for the initial stake
    uint256 public epoch1Start;

    // duration of each epoch
    uint256 public EPOCH_DURATION = 604800;

    uint256 public constant BLOCK_PER_YEAR = 2300000;
    uint256 public constant MAGNITUDE_ADJUST = 48;
    int256 public constant SCALER = 10**18;

    uint256 public override withdrawFeeMultiplier;
    uint256 public negInterestRateLast;
    uint256 public posInterestRateLast;
    uint256 public blockNumberLast;

    uint256 public multiplier;
    uint256 public offsett;

    uint128 epochId;
    mapping(uint128 => uint256) epochRewardValues;

    int256 max = 20 * 10**18;
    int256 min = -20 * 10**18;

    address public reignDAO;

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "SoV-Reign: FORBIDDEN");
        _;
    }

    constructor(
        uint256 _multiplier,
        uint256 _offsett,
        address _reignDAO,
        uint256 _epoch1Start
    ) {
        multiplier = _multiplier;
        offsett = _offsett;
        reignDAO = _reignDAO;
        epoch1Start = _epoch1Start;
    }

    function getDelta(uint256 reserves, uint256 target)
        public
        view
        returns (int256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 delta =
            ((SCALER.mul(_target.sub(_reserves))).div(_target)).mul(100);
        if (delta > max) return max;
        if (delta < min) return min;
        return delta;
    }

    //Computes what the interest on a single block by getting the Yearly rate based on the curve
    function getInterestForReserve(uint256 reserves, uint256 target)
        public
        view
        override
        returns (uint256, uint256)
    {
        require(
            reserves > 0,
            "SoV-Reign InterestStrategy: reserves can not be 0"
        );

        require(
            target > 0,
            "SoV-Reign InterestStrategy: reserves can not be 0"
        );

        int256 delta = getDelta(reserves, target);
        int256 interestInt =
            int256(multiplier).mul(delta.mul(delta).mul(delta));

        uint256 positive;
        uint256 negative;

        if (interestInt >= 0) {
            uint256 interest = uint256(interestInt);
            positive = (interest.div(BLOCK_PER_YEAR)).add(offsett);
        } else {
            negative = (uint256(interestInt.mul(-1)).div(BLOCK_PER_YEAR));
            if (negative < offsett) {
                positive = offsett.sub(negative);
                negative = 0;
            } else {
                negative = negative.sub(offsett);
            }
        }

        return (
            positive.div(10**MAGNITUDE_ADJUST),
            negative.div(10**MAGNITUDE_ADJUST)
        );
    }

    //Sets the offsett to a new value
    function setOffsett(uint256 newOffsett)
        public
        override
        onlyDAO
        returns (bool)
    {
        offsett = newOffsett;
        return true;
    }

    //Sets the Multiplier to a new value
    function setMultiplier(uint256 newMultiplier)
        external
        override
        onlyDAO
        returns (bool)
    {
        multiplier = newMultiplier;
        return true;
    }

    function getEpochRewards(uint128 _epochId)
        external
        view
        override
        returns (uint256)
    {
        return epochRewardValues[_epochId];
    }

    function accrueInterest(uint256 reserves, uint256 target)
        external
        override
        returns (bool)
    {
        uint256 _currentBlockNumber = block.number;
        uint256 _accrualBlockNumberPrior = blockNumberLast;

        // Do not accrue two times in a single block
        if (_accrualBlockNumberPrior == _currentBlockNumber) {
            return false;
        }

        if (reserves == 0) {
            blockNumberLast = _currentBlockNumber;
            return false;
        }

        uint256 _reserves = reserves;
        uint256 _target = target;

        (uint256 _positiveInterestRate, uint256 _negativeInterestRate) =
            getInterestForReserve(_reserves, _target);

        // Calculate the number of blocks elapsed since the last accrual
        uint256 _blockDelta = _currentBlockNumber.sub(_accrualBlockNumberPrior);

        if (_positiveInterestRate == 0) {
            uint256 _accumulatedInterest =
                _negativeInterestRate.mul(_blockDelta);
            if (_negativeInterestRate > negInterestRateLast) {
                withdrawFeeMultiplier = withdrawFeeMultiplier.add(
                    _accumulatedInterest
                );
            } else if (_negativeInterestRate < negInterestRateLast) {
                if (withdrawFeeMultiplier > _accumulatedInterest) {
                    withdrawFeeMultiplier = withdrawFeeMultiplier.sub(
                        _accumulatedInterest
                    );
                } else {
                    withdrawFeeMultiplier = 0;
                }
            } // if interest is the same as last do not change it
        } else {
            withdrawFeeMultiplier = 0;
            //TODO: Here accrue positive interest as well
            uint256 _accumulatedInterest =
                _positiveInterestRate.mul(_blockDelta);
            uint128 epoch = getCurrentEpoch();
            uint256 currentRewards = epochRewardValues[epoch];
            epochRewardValues[epoch] = currentRewards.add(_accumulatedInterest);
        }

        blockNumberLast = _currentBlockNumber;
        negInterestRateLast = _negativeInterestRate;
    }

    /*
     * Returns the id of the current epoch derived from block.timestamp
     */
    function getCurrentEpoch() public view returns (uint128) {
        if (block.timestamp < epoch1Start) {
            return 0;
        }

        return uint128((block.timestamp - epoch1Start) / EPOCH_DURATION + 1);
    }
}
