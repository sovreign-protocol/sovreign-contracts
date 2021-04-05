// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IBasketBalancer.sol";

contract BasketBalancerMock is IBasketBalancer {
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
    ) public override {}

    function updateBasketBalance() external override returns (bool) {
        return true;
    }

    function computeAllocation()
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256[] memory empty;
        return empty;
    }

    function getAllocationVote(address voter)
        public
        view
        override
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
        return 500000;
    }

    function addPool(address pool) public override returns (uint256) {
        return allPools.length;
    }

    function getPools() public view override returns (address[] memory) {
        return allPools;
    }
}
