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

    uint256 public constant blocksPerYear = 2102400;
    int256 public constant scaler = 10**18;
    uint256 public constant magnitudeAdjust = 48;

    uint256 multiplier;
    uint256 offsett;

    int256 max = 20 * 10**18;
    int256 min = -20 * 10**18;

    constructor(uint256 _multiplier, uint256 _offsett) {
        multiplier = _multiplier;
        offsett = _offsett;
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
    function setOffsett(uint256 newOffsett) public override returns (bool) {
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
        returns (bool)
    {
        multiplier = newMultiplier;
        return true;
    }

    //Gets the current Multiplier
    function getMultiplier() external view override returns (uint256) {
        return multiplier;
    }
}
