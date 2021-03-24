// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "./interfaces/InterestStrategyInterface.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//Describes a cubic parabola
contract InterestStrategy is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 public constant blocksPerYear = 2102400;

    uint256 multiplier = 3 * 10**12;
    uint256 offsett = 2 * 10**36;

    constructor() {}

    //Computes what the interest on a single blcok by getting the Yearly rate based on the curve
    function getInterestForReserve(uint256 reserves, uint256 target)
        public
        view
        override
        returns (uint256, uint256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 scaler = 10**18; //this allows to have a division of hole numbers
        int256 delta = (scaler.mul(_target.sub(_reserves))).div(_target);
        int256 interestInt =
            int256(multiplier).mul(delta.mul(delta).mul(delta)).div(scaler);

        uint256 positive;
        uint256 negative;

        if (interestInt >= 0) {
            uint256 interest = uint256(interestInt);
            positive = (interest / (blocksPerYear)).add(offsett);
        } else {
            negative = (uint256(interestInt.mul(-1)) / (blocksPerYear));
            if (negative < offsett) {
                positive = offsett - negative;
                negative = 0;
            } else {
                negative = negative - offsett;
            }
        }

        return (positive / 10**25, negative / 10**25);
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
