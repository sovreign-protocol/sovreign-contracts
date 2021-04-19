// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.7.6;

import "../interfaces/InterestStrategyInterface.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//Describes a cubic parabola
contract InterestStrategy is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 public constant blocksPerYear = 2300000;
    int256 public constant scaler = 10**18;
    uint256 public constant magnitudeAdjust = 48;

    uint256 public override withdrawFeeMultiplier;
    uint256 public override epochRewardValue;
    uint256 public interestRateLast;
    uint256 public blockNumberLast;

    uint256 multiplier;
    uint256 offsett;

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
        address _reignDAO
    ) {
        multiplier = _multiplier;
        offsett = _offsett;
        reignDAO = _reignDAO;
    }

    function getDelta(uint256 reserves, uint256 target)
        public
        view
        returns (int256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 delta =
            ((scaler.mul(_target.sub(_reserves))).div(_target)).mul(100);
        if (delta > max) return max;
        if (delta < min) return min;
        return delta;
    }

    //Computes what the interest on a single blcok by getting the Yearly rate based on the curve
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
            positive = (interest.div(blocksPerYear)).add(offsett);
        } else {
            negative = (uint256(interestInt.mul(-1)).div(blocksPerYear));
            if (negative < offsett) {
                positive = offsett.sub(negative);
                negative = 0;
            } else {
                negative = negative.sub(offsett);
            }
        }

        return (
            positive.div(10**magnitudeAdjust),
            negative.div(10**magnitudeAdjust)
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

    //Gets the current offsett
    function getOffsett() external view override returns (uint256) {
        return offsett;
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

    //Gets the current Multiplier
    function getMultiplier() external view override returns (uint256) {
        return multiplier;
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
            if (_negativeInterestRate > interestRateLast) {
                withdrawFeeMultiplier = withdrawFeeMultiplier.add(
                    _accumulatedInterest
                );
            } else if (_negativeInterestRate < interestRateLast) {
                if (withdrawFeeMultiplier > _accumulatedInterest) {
                    withdrawFeeMultiplier = withdrawFeeMultiplier.sub(
                        _accumulatedInterest
                    );
                } else {
                    withdrawFeeMultiplier = 0;
                }
            } // if interest is the same as last do not change it
        } else {
            //TODO: Here accrue positive interest as well
            withdrawFeeMultiplier = 0;
        }

        blockNumberLast = _currentBlockNumber;
        interestRateLast = _negativeInterestRate;
    }
}
