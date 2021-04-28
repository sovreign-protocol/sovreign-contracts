// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IReign.sol";
import "../interfaces/IBasketBalancer.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancer is IBasketBalancer {
    using SafeMath for uint256;

    uint256 public epoch1Start;

    uint256 public EPOCH_DURATION = 604800;

    uint256 public lastEpochUpdate;
    uint256 public lastEpochEnd;

    address[] allPools;
    mapping(address => uint256) poolAllocation;
    mapping(address => uint256) poolAllocationBefore;

    address[] public voters;

    struct AllocationVote {
        address[] pools;
        uint256[] allocations;
        uint256 lastUpdated;
    }
    mapping(address => AllocationVote) allocationVotes;

    uint256 public override FULL_ALLOCATION = 1000000000; // 9 decimals precision
    uint256 public UPDATE_PERIOD = 172800; // ca. two days in seconds

    uint256 public maxDelta;

    IReign reign;

    // 'controller' here means the PoolController contract
    address public controller;

    modifier onlyController() {
        require(
            msg.sender == controller,
            "Only the Controller can execute this"
        );
        _;
    }

    // 'controller' here means the PoolController contract
    address public reignDAO;

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "Only the DAO can execute this");
        _;
    }

    // - init newPools with empty array
    // - init newAllocation with empty array
    // - both are only required if we would like to update
    // the BasketBalancer at a later stage and re-use existing pools.
    constructor(
        address[] memory _newPools,
        uint256[] memory _newAllocation,
        address _reignAddress,
        address _reignDAO,
        address _controller,
        uint256 _maxDelta,
        uint256 _epoch1Start
    ) {
        uint256 amountAllocated = 0;

        if (_newPools.length != 0 && _newAllocation.length != 0) {
            for (uint256 i = 0; i < _newPools.length; i++) {
                uint256 poolPercentage = _newAllocation[i];
                amountAllocated = amountAllocated.add(poolPercentage);
                poolAllocation[_newPools[i]] = poolPercentage;
            }
            require(
                amountAllocated == FULL_ALLOCATION,
                "allocation is not complete"
            );
        }
        epoch1Start = _epoch1Start;
        lastEpochUpdate = 0;
        maxDelta = _maxDelta;
        allPools = _newPools;
        reign = IReign(_reignAddress);
        controller = _controller;
        reignDAO = _reignDAO;
    }

    function updateBasketBalance() external override returns (bool) {
        require(lastEpochUpdate < getCurrentEpoch(), "Epoch is not over");
        uint256[] memory allocations = computeAllocation();

        for (uint256 i = 0; i < allPools.length; i++) {
            poolAllocationBefore[allPools[i]] = poolAllocation[allPools[i]];
            poolAllocation[allPools[i]] = allocations[i];
        }

        lastEpochUpdate = getCurrentEpoch();
        lastEpochEnd = block.timestamp;

        return true;
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
        for (uint256 i = 0; i < allPools.length; i++) {
            require(allPools[i] == pools[i], "pools have incorrect order");
            uint256 _newAllocation = allocations[i];
            uint256 _oldAllocation = poolAllocation[allPools[i]];
            if (_newAllocation > _oldAllocation) {
                require(
                    _newAllocation - _oldAllocation <= maxDelta,
                    "Above Max Delta"
                );
            } else {
                require(
                    _oldAllocation - _newAllocation <= maxDelta,
                    "Above Max Delta"
                );
            }
            amountAllocated = amountAllocated.add(_newAllocation);
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

    /*
     *   SETTERS
     */

    function setController(address _controller) public onlyController {
        controller = _controller;
    }

    function setReignDAO(address _reignDAO) public onlyDAO {
        reignDAO = _reignDAO;
    }

    function setMaxDelta(uint256 _maxDelta) public onlyDAO {
        maxDelta = _maxDelta;
    }

    function computeAllocation()
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256[] memory _allocations = new uint256[](allPools.length);

        uint256 totalAllocation = 0;
        uint256 totalPower = reign.bondStaked();

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];

            uint256 votingPower = reign.balanceOf(voter);
            uint256 remainingPower = totalPower.sub(votingPower);

            AllocationVote storage votersVote = allocationVotes[voter];

            for (uint256 ii = 0; ii < votersVote.pools.length; ii++) {
                uint256 poolPercentage = votersVote.allocations[ii];

                address pool = votersVote.pools[ii];
                _allocations[ii] = getTargetAllocation(pool)
                    .mul(remainingPower)
                    .add(poolPercentage.mul(votingPower))
                    .div(totalPower);
                totalAllocation.add(_allocations[ii]);
            }
        }
        //division may create a reminder of 1
        if (totalAllocation != FULL_ALLOCATION) {
            _allocations[0] = _allocations[0].add(1);
        }

        return (_allocations);
    }

    /*
     *   VIEWS
     */
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
        uint256 timeElapsed = block.timestamp - lastEpochEnd;
        if (
            timeElapsed < UPDATE_PERIOD ||
            poolAllocationBefore[pool] == poolAllocation[pool]
        ) {
            if (poolAllocationBefore[pool] > poolAllocation[pool]) {
                return
                    poolAllocationBefore[pool].sub(
                        timeElapsed.mul(
                            poolAllocationBefore[pool].sub(poolAllocation[pool])
                        ) / UPDATE_PERIOD
                    );
            } else {
                return
                    poolAllocationBefore[pool].add(
                        timeElapsed.mul(
                            poolAllocation[pool].sub(poolAllocationBefore[pool])
                        ) / UPDATE_PERIOD
                    );
            }
        } else {
            return poolAllocation[pool];
        }
    }

    function getPools() public view override returns (address[] memory) {
        return allPools;
    }

    /*
     * Returns the id of the current epoch derived from block.timestamp
     */
    function getCurrentEpoch() public view returns (uint128) {
        if (block.timestamp < epoch1Start) {
            return 0;
        }

        return uint128((block.timestamp - epoch1Start) / EPOCH_DURATION + 1);
    }
}
