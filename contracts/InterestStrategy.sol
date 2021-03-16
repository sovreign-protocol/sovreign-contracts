// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../interfaces/InterestStrategyInterface.sol";

import "../node_modules/openzeppelin-contracts/math/SafeMath.sol";
import "../node_modules/openzeppelin-contracts/math/SignedSafeMath.sol";
import "../node_modules/openzeppelin-contracts/access/Ownable.sol";

//Describes a cubic parabola
contract InterestStrategy is InterestStrategyInterface {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 offsett;
    uint256 multiplier;

    constructor(uint256 _offesett, uint256 _multiplier) {
        offsett = _offesett;
        multiplier = _multiplier;
    }

    //Computes what the interest is at the point on the curve described by the difference between actual reserves and target
    function getInterestForReserve(uint256 reserves, uint256 target)
        public
        view
        override
        returns (int256)
    {
        int256 _reserves = int256(reserves);
        int256 _target = int256(target);
        int256 scaler = 100000; //this allows to have a division of hole numbers
        int256 delta = (scaler.mul(_target.sub(_reserves))).div(_target);
        int256 interest = int256(multiplier).mul(delta.mul(delta).mul(delta));
        return interest.div(scaler).add(int256(offsett));
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
