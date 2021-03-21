pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./interfaces/IBarn.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancer {
    using SafeMath for uint256;
    mapping(address => uint256) allocation;
    address[] pools;

    uint256 FULL_ALLOCATION = 1000000;

    IBarn barn;

    mapping(address => uint256) public lastVote;

    address DAO;

    modifier onlyDAO() {
        require(msg.sender == DAO, "Only the DAO can edit this");
        _;
    }

    constructor(
        address[] memory newPools,
        uint256[] memory newTargets,
        address barnAddress,
        address dao
    ) {
        uint256 amountAllocated = 0;
        for (uint256 i = 0; i < newPools.length; i++) {
            uint256 poolPercentage = newTargets[i];
            amountAllocated = amountAllocated.add(poolPercentage);
            allocation[newPools[i]] = poolPercentage;
        }
        require(
            amountAllocated == FULL_ALLOCATION,
            "allocation is not complete"
        );

        pools = newPools;
        barn = IBarn(barnAddress);
        DAO = dao;
    }

    function makeVote(address[] calldata pool_list, uint256[] calldata targets)
        public
    {
        require(pool_list.length == targets.length, "Need to have same length");

        uint256 votingPower = barn.balanceOf(msg.sender);

        uint256 totalPower = barn.bondStaked();

        uint256 remainingPower = totalPower.sub(votingPower);

        uint256 amountAllocated = 0;
        for (uint256 i = 0; i < pool_list.length; i++) {
            uint256 poolPercentage = targets[i];

            amountAllocated = amountAllocated.add(poolPercentage);

            address pool = pool_list[i];
            allocation[pool] = allocation[pool]
                .mul(remainingPower)
                .add(poolPercentage.mul(votingPower))
                .div(totalPower);
        }

        require(
            amountAllocated == FULL_ALLOCATION,
            "allocation is not complete"
        );
    }

    function addPool(address pool) public onlyDAO returns (uint256) {
        //Verify that this address is of a contract implementing the Pool interface
        pools.push(pool);
        allocation[pool] = 0;
        return pools.length;
    }

    function getAllocation(address pool) public view returns (uint256) {
        return allocation[pool];
    }

    function getPools() public view returns (address[] memory) {
        return pools;
    }
}
