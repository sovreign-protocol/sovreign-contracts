// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/InterestStrategyInterface.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InterestStrategy is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 public constant EPOCH_DURATION = 604800;
    uint256 public constant BLOCK_PER_YEAR = 2300000;

    uint256 public constant MAGNITUDE_ADJUST = 48;

    int256 public constant SCALER = 10**20;

    int256 private constant MAX = 20 * 10**18;
    int256 private constant MIN = -20 * 10**18;

    // timestamp for the epoch 1
    // everything before that is considered epoch 0
    uint256 public epoch1Start;

    uint256 public override withdrawFeeAccrued;
    uint256 public blockNumberLast;

    uint256 public multiplier;
    uint256 public offset;

    int256 public baseDelta;

    uint256 private negativeOutputLast;
    uint256 private posInterestRateLast;

    uint128 private epochId;

    mapping(uint128 => uint256) epochRewardValues;

    address public override reignDAO;

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "Only the DAO can execute this");
        _;
    }

    constructor(
        uint256 _multiplier,
        uint256 _offset,
        int256 _baseDelta,
        address _reignDAO,
        uint256 _epoch1Start
    ) {
        multiplier = _multiplier;
        offset = _offset;
        baseDelta = _baseDelta;
        reignDAO = _reignDAO;
        epoch1Start = _epoch1Start;
    }

    // accrueInterest is called every time a user interacts with the pool,
    // the interest is computed by multipling the blocks elapsed since last update by the output
    // of the formula normalised against the set base value.
    //
    // returns true if interest was accrued
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

        // Dont do enything if pool is empty
        if (reserves == 0) {
            return false;
        }

        uint256 _reserves = reserves;
        uint256 _target = target;

        // Get the positive or negative output of the cubic parabula
        (uint256 _positiveOutput, uint256 _negativeOutput) =
            getFormulaOutput(_reserves, _target);

        // Normalise it against the base values
        (uint256 _positiveRate, uint256 _negativeRate) =
            _getNormalizedToBase(_positiveOutput, _negativeOutput);

        // Calculate the number of blocks elapsed since the last accrual
        uint256 _blockDelta = _currentBlockNumber.sub(_accrualBlockNumberPrior);

        // If the value is negative adapt withdraw fee
        if (_positiveOutput == 0) {
            uint256 _accumulatedInterest = _negativeRate.mul(_blockDelta);
            // If output is increased, increase the fee
            if (_negativeOutput > negativeOutputLast) {
                withdrawFeeAccrued = withdrawFeeAccrued.add(
                    _accumulatedInterest
                );
            }
            // If output is decrease, decrease the fee
            else if (_negativeOutput < negativeOutputLast) {
                if (withdrawFeeAccrued > _accumulatedInterest) {
                    withdrawFeeAccrued = withdrawFeeAccrued.sub(
                        _accumulatedInterest
                    );
                } else {
                    withdrawFeeAccrued = 0;
                }
            }
        }
        // If the value is positive accrue the rewards to current epoch
        else {
            // To be resiliant to Flashloans beeing used to drop withdraw fee to 0 in a single block
            // we only make it 0 if negative interest is sustained for more then 1 block
            if (negativeOutputLast == 0) {
                withdrawFeeAccrued = 0;
            }
            uint256 _accumulatedInterest = _positiveRate.mul(_blockDelta);
            uint128 _epoch = getCurrentEpoch();
            uint256 _currentRewards = epochRewardValues[_epoch];
            epochRewardValues[_epoch] = _currentRewards.add(
                _accumulatedInterest
            );
        }

        blockNumberLast = _currentBlockNumber;
        negativeOutputLast = _negativeOutput;
        return true;
    }

    /*
     *   SETTERS
     */

    //Sets the offset to a new value
    function setOffset(uint256 newOffsett)
        public
        override
        onlyDAO
        returns (bool)
    {
        offset = newOffsett;
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

    //Sets the Multiplier to a new value
    function setBaseDelta(int256 newBaseDelta)
        external
        override
        onlyDAO
        returns (bool)
    {
        baseDelta = newBaseDelta;
        return true;
    }

    /*
     *   VIEWS
     */

    // Computes the delta between the reserves and the target size as a deciamal
    // Delta is an int256 and can be negative and it is caped in a range between MAX and MIN
    function getDelta(uint256 reserves, uint256 target)
        public
        pure
        returns (int256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 delta = ((SCALER.mul(_target.sub(_reserves))).div(_target));
        if (delta > MAX) return MAX;
        if (delta < MIN) return MIN;
        return delta;
    }

    // Computes the Y value of the cubic parabola based on delta between reserves and target
    // The possible positve and negative values are returned through two unit256s
    function getFormulaOutput(uint256 reserves, uint256 target)
        public
        view
        override
        returns (uint256, uint256)
    {
        require(
            reserves > 0,
            "SoVReign InterestStrategy: reserves can not be 0"
        );
        require(target > 0, "SoVReign InterestStrategy: reserves can not be 0");

        int256 _delta = getDelta(reserves, target);
        int256 _interestInt =
            int256(multiplier).mul(_delta.mul(_delta).mul(_delta));

        uint256 _offset = offset; // gas savings

        uint256 _positive;
        uint256 _negative;

        if (_interestInt >= 0) {
            uint256 interest = uint256(_interestInt);
            _positive = (interest.div(BLOCK_PER_YEAR)).add(_offset);
        } else {
            _negative = (uint256(_interestInt.mul(-1)).div(BLOCK_PER_YEAR));
            if (_negative < _offset) {
                _positive = _offset.sub(_negative);
                _negative = 0;
            } else {
                _negative = _negative.sub(_offset);
            }
        }

        return (
            _positive.div(10**MAGNITUDE_ADJUST),
            _negative.div(10**MAGNITUDE_ADJUST)
        );
    }

    // Returns the id of the current epoch derived from block.timestamp
    // Pool Epochs are 1 behind staking epoch
    function getCurrentEpoch() public view returns (uint128) {
        if (block.timestamp < (epoch1Start)) {
            return 0;
        }

        return uint128((block.timestamp - epoch1Start) / EPOCH_DURATION + 1);
    }

    // Returns the rewards that have accrues during a given epoch, future epochs return 0
    function getEpochRewards(uint128 _epochId)
        external
        view
        override
        returns (uint256)
    {
        return epochRewardValues[_epochId];
    }

    // Normalises the inputs against the base value, such that outputs at baseDelta is 1
    function _getNormalizedToBase(uint256 _positive, uint256 _negative)
        internal
        view
        returns (uint256, uint256)
    {
        (uint256 _positiveBase, uint256 _negativeBase) = _getBaseOutput();

        if (_negativeBase == 0) {
            return (
                _positive.mul(10**18).div(_positiveBase),
                _negative.mul(10**18).div(_positiveBase)
            );
        } else {
            return (
                _positive.mul(10**18).div(_negativeBase),
                _negative.mul(10**18).div(_negativeBase)
            );
        }
    }

    // Gets the output of the curve function for the currentl set baseDelta
    function _getBaseOutput() internal view returns (uint256, uint256) {
        int256 target = 1 * 10**26;
        int256 reserves = target.sub(target.mul(baseDelta).div(SCALER));
        require(target > 0);
        require(reserves > 0);

        return getFormulaOutput(uint256(reserves), uint256(target));
    }
}
