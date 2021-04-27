// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

//Describes a cubic parabola
interface InterestStrategyInterface {
    //Gets the current Multiplier
    function withdrawFeeMultiplier() external view returns (uint256);

    //Gets the current epoch rewards
    function getEpochRewards(uint128) external view returns (uint256);

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
    function setOffset(uint256 newOffset) external returns (bool);

    //Sets the Multiplier to a new value
    function setMultiplier(uint256 newMultiplier) external returns (bool);

    //Sets the Multiplier to a new value
    function setBaseDelta(int256 newBaseDelta) external returns (bool);
}
