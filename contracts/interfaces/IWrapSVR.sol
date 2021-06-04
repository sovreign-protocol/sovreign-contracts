// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

interface IWrapSVR {
    function deposit(
        address user,
        uint256 amount,
        uint256 liquidationPrice
    ) external;

    function withdraw(
        address svrHolder,
        address lpOwner,
        uint256 amount
    ) external;

    function liquidate(
        address liquidator,
        address from,
        uint256 amount
    ) external;

    function getEpochId(uint256 timestamp) external view returns (uint256); // get epoch id

    function getEpochUserBalance(address user, uint128 epoch)
        external
        view
        returns (uint256);

    function getEpochPoolSize(uint128 epoch) external view returns (uint256);

    function epoch1Start() external view returns (uint256);

    function epochDuration() external view returns (uint256);

    function getRewardsForEpoch(uint128, address)
        external
        view
        returns (uint256, uint256);
}
