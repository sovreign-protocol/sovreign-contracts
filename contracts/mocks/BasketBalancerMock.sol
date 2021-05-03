// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IBasketBalancer.sol";

contract BasketBalancerMock is IBasketBalancer {
    uint256 public override FULL_ALLOCATION = 1000000000; // 9 decimals precision

    address[] allPools;
    mapping(address => uint256) poolAllocation;

    constructor(address[] memory newPools, uint256[] memory newAllocation) {
        for (uint256 i = 0; i < newPools.length; i++) {
            uint256 poolPercentage = newAllocation[i];
            poolAllocation[newPools[i]] = poolPercentage;
        }
        allPools = newPools;
    }

    function updateAllocationVote(
        address[] calldata pools,
        uint256[] calldata allocations
    ) public {}

    function updateBasketBalance() external pure {}

    function computeAllocation() public pure returns (uint256[] memory) {
        uint256[] memory empty;
        return empty;
    }

    function getAllocationVote()
        public
        pure
        returns (
            address[] memory,
            uint256[] memory,
            uint256
        )
    {
        address[] memory empty1;
        uint256[] memory empty2;
        return (empty1, empty2, 0);
    }

    function getTargetAllocation(address pool)
        public
        view
        override
        returns (uint256)
    {
        return poolAllocation[pool];
    }

    function addPool(address pool) public override returns (uint256) {
        poolAllocation[pool] = 500000000;
        return allPools.length;
    }

    function getPools() public view returns (address[] memory) {
        return allPools;
    }
}
