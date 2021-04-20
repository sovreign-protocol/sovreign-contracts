// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IReign.sol";
import "../interfaces/IBasketBalancer.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancer is IBasketBalancer {
    using SafeMath for uint256;

    address[] allPools;
    mapping(address => uint256) poolAllocation;

    address[] public voters;

    struct AllocationVote {
        address[] pools;
        uint256[] allocations;
        uint256 lastUpdated;
    }
    mapping(address => AllocationVote) allocationVotes;

    uint256 FULL_ALLOCATION = 1000000;

    IReign reign;

    // 'controller' here means the PoolController contract
    address public controller;

    modifier onlyController() {
        require(msg.sender == controller, "Only the DAO can edit this");
        _;
    }

    // - init newPools with empty array
    // - init newAllocation with empty array
    // - both are only required if we would like to update
    // the BasketBalancer at a later stage and re-use existing pools.
    constructor(
        address[] memory newPools,
        uint256[] memory newAllocation,
        address reignAddress
    ) {
        uint256 amountAllocated = 0;

        if (newPools.length != 0 && newAllocation.length != 0) {
            for (uint256 i = 0; i < newPools.length; i++) {
                uint256 poolPercentage = newAllocation[i];
                amountAllocated = amountAllocated.add(poolPercentage);
                poolAllocation[newPools[i]] = poolPercentage;
            }
            require(
                amountAllocated == FULL_ALLOCATION,
                "allocation is not complete"
            );
        }

        allPools = newPools;
        reign = IReign(reignAddress);
        controller = msg.sender;
    }

    function setController(address _controller) public {
        require(msg.sender == controller, "Only Controller can do this");
        controller = _controller;
    }

    function updateAllocationVote(
        address[] calldata pools,
        uint256[] calldata allocations
    ) public override {
        require(pools.length == allocations.length, "Need to have same length");

        require(reign.balanceOf(msg.sender) > 0, "Not allowed to vote");

        AllocationVote memory currentVote = allocationVotes[msg.sender];

        if (currentVote.lastUpdated == 0) {
            voters.push(msg.sender);
        }

        uint256 amountAllocated = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            require(allPools[i] == pools[i], "pools have incorrect order");
            amountAllocated = amountAllocated.add(allocations[i]);
        }
        require(
            amountAllocated == FULL_ALLOCATION,
            "Allocation is not complete"
        );

        currentVote.pools = pools;
        currentVote.allocations = allocations;
        currentVote.lastUpdated = block.timestamp;

        allocationVotes[msg.sender] = currentVote;

        //emit event
    }

    function updateBasketBalance() external override returns (bool) {
        uint256[] memory allocations = computeAllocation();

        for (uint256 i = 0; i < allPools.length; i++) {
            poolAllocation[allPools[i]] = allocations[i];
        }

        return true;
    }

    function computeAllocation()
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256[] memory _allocations = new uint256[](allPools.length);

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];

            uint256 votingPower = reign.balanceOf(voter);
            uint256 totalPower = reign.bondStaked();
            uint256 remainingPower = totalPower.sub(votingPower);

            AllocationVote storage votersVote = allocationVotes[voter];

            for (uint256 ii = 0; ii < votersVote.pools.length; ii++) {
                uint256 poolPercentage = votersVote.allocations[ii];

                address pool = votersVote.pools[ii];
                _allocations[ii] = getTargetAllocation(pool)
                    .mul(remainingPower)
                    .add(poolPercentage.mul(votingPower))
                    .div(totalPower);
            }
        }

        return (_allocations);
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
        AllocationVote memory vote = allocationVotes[voter];

        return (vote.pools, vote.allocations, vote.lastUpdated);
    }

    function getTargetAllocation(address pool)
        public
        view
        override
        returns (uint256)
    {
        return poolAllocation[pool];
    }

    function addPool(address pool)
        public
        override
        onlyController
        returns (uint256)
    {
        allPools.push(pool);
        poolAllocation[pool] = 0;
        return allPools.length;
    }

    function getPools() public view override returns (address[] memory) {
        return allPools;
    }
}
