// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface IBasketBalancer {
    function addPool(address pool) external returns (uint256);

    function hasVotedInEpoch(address, uint128) external view returns (bool);

    function getTargetAllocation(address pool) external view returns (uint256);

    function FULL_ALLOCATION() external view returns (uint256);

    function updateBasketBalance() external;

    function reignAddress() external view returns (address);
}
