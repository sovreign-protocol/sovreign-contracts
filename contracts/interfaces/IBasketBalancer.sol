// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface IBasketBalancer {
    function makeVote(address[] calldata pool_list, uint256[] calldata targets)
        external;

    function addPool(address pool) external returns (uint256);

    function getTargetAllocation(address pool) external view returns (uint256);

    function getPools() external view returns (address[] memory);
}
