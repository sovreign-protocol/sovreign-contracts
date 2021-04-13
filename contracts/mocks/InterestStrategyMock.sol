// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.7.6;

import "../interfaces/InterestStrategyInterface.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//Describes a cubic parabola
contract InterestStrategyMock is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 public constant blocksPerYear = 2102400;

    constructor() {}

    function getDelta(uint256 reserves, uint256 target)
        public
        pure
        returns (int256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 scaler = 10**18; //this allows to have a division of hole numbers
        int256 delta = (scaler.mul(_target.sub(_reserves))).div(_target);
        return delta;
    }

    //Computes what the interest on a single blcok by getting the Yearly rate based on the curve
    function getInterestForReserve(uint256 reserves, uint256 target)
        public
        pure
        override
        returns (uint256, uint256)
    {
        if (reserves <= target) {
            return (((target.sub(reserves)) * 10**18) / (blocksPerYear), 0);
        } else {
            return (0, ((reserves.sub(target)) * 10**18) / (blocksPerYear));
        }
    }

    //Sets the offsett to a new value
    function setOffsett(uint256 newOffsett) public override returns (bool) {
        return true;
    }

    //Gets the current offsett
    function getOffsett() external view override returns (uint256) {
        return 0;
    }

    //Sets the Multiplier to a new value
    function setMultiplier(uint256 newMultiplier)
        external
        override
        returns (bool)
    {
        return true;
    }

    //Gets the current Multiplier
    function getMultiplier() external view override returns (uint256) {
        return 0;
    }
}
