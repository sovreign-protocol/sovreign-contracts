// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

//Describes a cubic parabola
interface InterestStrategyInterface {
    //Gets the current Multiplier
    function withdrawFeeMultiplier() external view returns (uint256);

    //Gets the current epoch rewards
    function epochRewardValue() external view returns (uint256);

    //Computes what the interest is at the point on the curve at the difference between reserves and target
    function getInterestForReserve(uint256 reserves, uint256 target)
        external
        view
        returns (uint256, uint256);

    //Accrues the current interest to both withdra fee multiplier and rewrads amount
    function accrueInterest(uint256 reserves, uint256 target)
        external
        returns (bool);

    //Sets the offsett to a new valuesß
    function setOffsett(uint256 newOffsett) external returns (bool);

    //Gets the current offsett
    function getOffsett() external view returns (uint256);

    //Sets the Multiplier to a new value
    function setMultiplier(uint256 newMultiplier) external returns (bool);

    //Gets the current Multiplier
    function getMultiplier() external view returns (uint256);
}
