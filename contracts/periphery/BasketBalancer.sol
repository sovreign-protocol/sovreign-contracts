// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IReign.sol";
import "../interfaces/IBasketBalancer.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancer is IBasketBalancer {
    using SafeMath for uint256;

    uint256 public epoch1Start;

    uint256 public override FULL_ALLOCATION = 1000000000; // 9 decimals precision
    uint256 public EPOCH_DURATION = 604800; // ca. one week in seconds
    uint256 public UPDATE_PERIOD = 172800; // ca. two days in seconds

    uint128 public lastEpochUpdate;
    uint256 public lastEpochEnd;

    uint256 public maxDelta;

    address[] public allPools;

    mapping(address => uint256) public continuousVote;
    mapping(address => uint256) private poolAllocation;
    mapping(address => uint256) private poolAllocationBefore;

    mapping(address => mapping(uint128 => bool)) private votedInEpoch;

    IReign private reign;
    address public controller;

    modifier onlyController() {
        require(
            msg.sender == controller,
            "Only the Controller can execute this"
        );
        _;
    }

    address public reignDAO;

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "Only the DAO can execute this");
        _;
    }

    // The _newPools and _newAllocation will be set empty for the first deployment but can be used
    // if the BasketBalancer is updated and existing allocation values need to be migrated to a new instance.
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

        require(
            _newPools.length == _newAllocation.length,
            "Need to have same length"
        );
        if (_newPools.length != 0 && _newAllocation.length != 0) {
            for (uint256 i = 0; i < _newPools.length; i++) {
                uint256 poolPercentage = _newAllocation[i];
                amountAllocated = amountAllocated.add(poolPercentage);
                continuousVote[_newPools[i]] = poolPercentage;
                poolAllocation[_newPools[i]] = poolPercentage;
                poolAllocationBefore[_newPools[i]] = poolPercentage;
            }
            require(
                amountAllocated == FULL_ALLOCATION,
                "Allocation is not complete"
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

    // Counts votes and sets the outcome allocation for each pool, can be called by anyone after an epoch ends.
    // The new allocation value is the average of the vote outcome and the current value
    // Note: this is not the actual target value that will be used by the pools,
    // the actual target will be returned by getTargetAllocation and includes update period adjustemnts
    function updateBasketBalance() external {
        require(lastEpochUpdate < getCurrentEpoch(), "Epoch is not over");

        // This is to prevent flashloan attacks to increase voting power,
        //users can not deposit into staking and initialize epoch in the same block
        require(
            reign.userLastAction(msg.sender) < block.timestamp,
            "Can not end epoch if deposited in same block"
        );

        for (uint256 i = 0; i < allPools.length; i++) {
            uint256 _currentValue = continuousVote[allPools[i]]; // new vote outcome
            uint256 _previousValue = poolAllocation[allPools[i]]; // before this vote

            // the new current value is the average between the 3 values
            poolAllocation[allPools[i]] = (_currentValue.add(_previousValue))
                .div(2);

            // update the previous value
            poolAllocationBefore[allPools[i]] = _previousValue;
        }

        lastEpochUpdate = getCurrentEpoch();
        lastEpochEnd = block.timestamp;
    }

    // Allows users to update their vote by giving a desired allocation for each pool
    // pools and allocations need to share the index, pool at index 1 will get allocation at index 1
    function updateAllocationVote(
        address[] calldata pools,
        uint256[] calldata allocations
    ) external {
        require(pools.length == allPools.length, "Need to vote for all pools");
        require(pools.length == allocations.length, "Need to have same length");
        require(reign.balanceOf(msg.sender) > 0, "Not allowed to vote");

        uint128 _epoch = getCurrentEpoch();

        require(
            votedInEpoch[msg.sender][_epoch] == false,
            "Can not vote twice in an epoch"
        );

        uint256 _totalPower = reign.bondStaked();
        // we take the voting power as it was at the end of the last epoch to avoid flashloan attacks
        // or users sending their stake to new wallets and vote again
        uint256 _votingPower =
            reign.votingPowerAtEpoch(msg.sender, lastEpochUpdate);
        uint256 _remainingPower = _totalPower.sub(_votingPower);

        uint256 amountAllocated = 0;
        for (uint256 i = 0; i < allPools.length; i++) {
            //Pools need to have the same order as allPools
            require(allPools[i] == pools[i], "Pools have incorrect order");
            uint256 _votedFor = allocations[i];
            uint256 _current = continuousVote[allPools[i]];
            amountAllocated = amountAllocated.add(_votedFor);

            // The difference between the voted for allocation and the current value can not exceed maxDelta
            if (_votedFor > _current) {
                require(_votedFor - _current <= maxDelta, "Above Max Delta");
            } else {
                require(_current - _votedFor <= maxDelta, "Above Max Delta");
            }
            // if all checkst have passed we update the allocation vote
            continuousVote[allPools[i]] = (
                _current.mul(_remainingPower).add(_votedFor.mul(_votingPower))
            )
                .div(_totalPower);
        }

        //transaction will revert if allocation is not complete
        require(
            amountAllocated == FULL_ALLOCATION,
            "Allocation is not complete"
        );

        votedInEpoch[msg.sender][_epoch] = true;

        //emit event
    }

    // adds a new pool to the list, can only be called by PoolController as a new Pool is created
    function addPool(address pool)
        external
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

    /*
     *   VIEWS
     */

    // gets the current target allocation taking into account the update period in which the allocation changes
    // from the previous one to the one last voted with a linear change each block
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

    //Returns the id of the current epoch derived from block.timestamp
    function getCurrentEpoch() public view returns (uint128) {
        return reign.getCurrentEpoch();
    }

    function getPools() external view returns (address[] memory) {
        return allPools;
    }

    function hasVotedInEpoch(address user, uint128 epoch)
        external
        view
        override
        returns (bool)
    {
        return votedInEpoch[user][epoch];
    }
}
