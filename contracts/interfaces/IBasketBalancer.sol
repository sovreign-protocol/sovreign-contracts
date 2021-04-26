// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface IBasketBalancer {
    function addPool(address pool) external returns (uint256);

    function getTargetAllocation(address pool) external view returns (uint256);

    function getPools() external view returns (address[] memory);

    function updateAllocationVote(
        address[] calldata pools,
        uint256[] calldata allocations
    ) external;

    function updateBasketBalance() external returns (bool);

    function computeAllocation() external view returns (uint256[] memory);

    function FULL_ALLOCATION() external view returns (uint256);

    function getAllocationVote(address voter)
        external
        view
        returns (
            address[] memory,
            uint256[] memory,
            uint256
        );
}
