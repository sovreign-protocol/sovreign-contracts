// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface IBasketBalancer {
    function addPool(address pool) external returns (uint256);

    function getTargetAllocation(address pool) external view returns (uint256);

    function FULL_ALLOCATION() external view returns (uint256);
}
