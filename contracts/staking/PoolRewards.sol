// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStaking.sol";
import "../interfaces/InterestStrategyInterface.sol";
import "../interfaces/IPoolController.sol";
import "../libraries/LibRewardsDistribution.sol";

contract PoolRewards {
    // lib
    using SafeMath for uint256;
    using SafeMath for uint128;

    // state variables

    // addreses
    address private _poolLP;
    address private _rewardsVault;
    address private _liquidityBuffer;
    // contracts
    IERC20 private _reignToken;
    IStaking private _staking;
    IPoolController private _controller;

    uint256[] private epochs;
    uint128 public lastInitializedEpoch;
    mapping(address => uint128) private lastEpochIdHarvested;
    uint256 public epochDuration; // init from staking contract
    uint256 public epochStart; // init from staking contract

    // events
    event MassHarvest(
        address indexed user,
        uint256 epochsHarvested,
        uint256 totalValue
    );
    event Harvest(
        address indexed user,
        uint128 indexed epochId,
        uint256 amount
    );

    // constructor
    constructor(
        address reignTokenAddress,
        address poolLP,
        address controller,
        address stakeContract,
        address rewardsVault,
        address liquidityBuffer
    ) {
        _reignToken = IERC20(reignTokenAddress);
        _poolLP = poolLP;
        _controller = IPoolController(controller);
        _staking = IStaking(stakeContract);
        _rewardsVault = rewardsVault;
        _liquidityBuffer = liquidityBuffer;
        epochDuration = _staking.epochDuration();
        epochStart = _staking.epoch1Start() + epochDuration;
    }

    // public methods
    // public method to harvest all the unharvested epochs until current epoch - 1
    function massHarvest() external returns (uint256) {
        uint256 totalDistributedValue;
        uint256 totalToBuffer;
        uint256 epochId = _getEpochId().sub(1); // fails in epoch 0

        for (
            uint128 i = lastEpochIdHarvested[msg.sender] + 1;
            i <= epochId;
            i++
        ) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            (uint256 userRewards, uint256 toBuffer) = _harvest(i);
            totalDistributedValue += userRewards;
            totalToBuffer += toBuffer;
        }

        emit MassHarvest(
            msg.sender,
            epochId - lastEpochIdHarvested[msg.sender],
            totalDistributedValue
        );

        if (totalDistributedValue > 0) {
            _reignToken.transferFrom(
                _rewardsVault,
                msg.sender,
                totalDistributedValue
            );
        }

        if (totalToBuffer > 0) {
            _reignToken.transferFrom(
                _rewardsVault,
                _liquidityBuffer,
                totalToBuffer
            );
        }

        return totalDistributedValue;
    }

    function harvest(uint128 epochId) external returns (uint256) {
        // checks for requested epoch
        require(_getEpochId() > epochId, "This epoch is in the future");
        require(
            lastEpochIdHarvested[msg.sender].add(1) == epochId,
            "Harvest in order"
        );
        (uint256 userReward, uint256 toBuffer) = _harvest(epochId);
        if (userReward > 0) {
            _reignToken.transferFrom(_rewardsVault, msg.sender, userReward);
        }
        if (toBuffer > 0) {
            _reignToken.transferFrom(_rewardsVault, _liquidityBuffer, toBuffer);
        }
        emit Harvest(msg.sender, epochId, userReward);
        return userReward;
    }

    // views
    // calls to the staking smart contract to retrieve the epoch total poolLP size
    function getPoolSize(uint128 epochId) external view returns (uint256) {
        return _getPoolSize(epochId);
    }

    function getCurrentEpoch() external view returns (uint256) {
        return _getEpochId();
    }

    // calls to the staking smart contract to retrieve user balance for an epoch
    function getEpochStake(address userAddress, uint128 epochId)
        external
        view
        returns (uint256)
    {
        return _getUserBalancePerEpoch(userAddress, epochId);
    }

    function userLastEpochIdHarvested() external view returns (uint256) {
        return lastEpochIdHarvested[msg.sender];
    }

    // internal methods

    function _initEpoch(uint128 epochId) internal {
        require(
            lastInitializedEpoch.add(1) == epochId,
            "Epoch can be init only in order"
        );
        lastInitializedEpoch = epochId;
        // call the staking smart contract to init the epoch
        epochs[epochId] = _getPoolSize(epochId);

        //Rebalance pools
        uint256 transferToBuffer = 0;
        uint256 transferToRewards = 0;

        // we get the accumalted interest for the epoch
        (uint256 epochRewards, uint256 baseRewards) =
            getRewardsForEpoch(epochId, _poolLP);

        // if this pools needs more rewards then base issuance, we need to transfer it
        if (epochRewards > baseRewards) {
            transferToRewards = transferToRewards.add(
                epochRewards - baseRewards
            );
        } else if (epochRewards < baseRewards) {
            // if this pools needs less rewards then base issuance, we remove it from the amount later
            transferToBuffer = transferToBuffer.add(baseRewards - epochRewards);
        }

        // We transfer the total difference across all pools to the buffer
        if (transferToRewards > transferToBuffer) {
            _reignToken.transferFrom(
                _liquidityBuffer,
                _rewardsVault,
                transferToRewards.sub(transferToBuffer)
            );
        }
    }

    function _harvest(uint128 epochId) internal returns (uint256, uint256) {
        // try to initialize an epoch. if it can't it fails
        // if it fails either user either a BarnBridge account will init not init epochs
        if (lastInitializedEpoch < epochId) {
            _initEpoch(epochId);
        }
        // Set user state for last harvested
        lastEpochIdHarvested[msg.sender] = epochId;
        // compute and return user total reward. For optimization reasons the transfer have been moved to an upper layer (i.e. massHarvest needs to do a single transfer)

        // exit if there is no stake on the epoch
        if (epochs[epochId] == 0) {
            return (0, 0);
        }
        (uint256 epochRewards, uint256 baseRewards) =
            _staking.getRewardsForEpoch(epochId, _poolLP);

        uint256 userEpochRewards =
            epochRewards.mul(_getUserBalancePerEpoch(msg.sender, epochId)).div(
                epochs[epochId]
            );

        uint256 userBaseRewards =
            baseRewards.mul(_getUserBalancePerEpoch(msg.sender, epochId)).div(
                epochs[epochId]
            );

        return (userEpochRewards, userBaseRewards);
    }

    function _getPoolSize(uint128 epochId) internal view returns (uint256) {
        // retrieve unilp token balance
        return _staking.getEpochPoolSize(_poolLP, _stakingEpochId(epochId));
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId)
        internal
        view
        returns (uint256)
    {
        // retrieve unilp token balance per user per epoch
        return
            _staking.getEpochUserBalance(
                userAddress,
                _poolLP,
                _stakingEpochId(epochId)
            );
    }

    // compute epoch id from blocktimestamp and epochstart date
    function _getEpochId() internal view returns (uint128 epochId) {
        if (block.timestamp < epochStart) {
            return 0;
        }
        epochId = uint128(
            block.timestamp.sub(epochStart).div(epochDuration).add(1)
        );
    }

    // get the staking epoch which is 1 epoch more
    function _stakingEpochId(uint128 epochId) internal pure returns (uint128) {
        return epochId + 1;
    }

    function getRewardsForEpoch(uint128 epochId, address _pool)
        public
        view
        returns (uint256, uint256)
    {
        uint256 epochRewards =
            (
                InterestStrategyInterface(
                    _controller.getInterestStrategy(_pool)
                )
                    .getEpochRewards(epochId - 1)
            )
                .mul(
                LibRewardsDistribution.rewardsPerBlockPerPool(
                    _controller.getTargetAllocation(_pool)
                )
            );
        uint256 epochRewardsAdjusted =
            epochRewards.mul(_controller.getAdjustment(_pool)).div(10**18); //account for 18 decimals of Adjustment

        uint256 baseRewards =
            LibRewardsDistribution.rewardsPerEpochPerPool(
                _controller.getTargetAllocation(_pool)
            );

        return (epochRewardsAdjusted, baseRewards);
    }
}
