// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

//Describes a cubic parabola
interface InterestStrategyInterface {
    //Computes what the interest is at the point on the curve at the difference between reserves and target
    function getInterestForReserve(uint256 reserves, uint256 target)
        external
        view
        returns (int256);

    //Sets the offsett to a new value
    function setOffsett(uint256 newOffsett) external returns (bool);

    //Gets the current offsett
    function getOffsett() external view returns (uint256);

    //Sets the Multiplier to a new value
    function setMultiplier(uint256 newMultiplier) external returns (bool);

    //Gets the current Multiplier
    function getMultiplier() external view returns (uint256);
}
