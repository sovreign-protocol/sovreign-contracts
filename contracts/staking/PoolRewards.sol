// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IStaking.sol";
import "../interfaces/InterestStrategyInterface.sol";
import "../interfaces/IBasketBalancer.sol";
import "../interfaces/IPoolController.sol";
import "../libraries/LibRewardsDistribution.sol";
import "../libraries/SafeERC20.sol";
import "hardhat/console.sol";

contract PoolRewards {
    // lib
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    // state variables

    // addreses
    address private _poolLP;
    address private _rewardsVault;
    address private _liquidityBuffer;
    // contracts
    IERC20 private _reignToken;
    IStaking private _staking;
    IPoolController private _controller;

    mapping(uint128 => uint256) private _sizeAtEpoch;
    uint128 public lastInitializedEpoch;
    mapping(address => uint128) private _lastEpochIdHarvested;
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
        epochDuration = _staking.EPOCH_DURATION();
        epochStart = _staking.epoch1Start() + epochDuration;
    }

    // public method to harvest all the unharvested epochs until current epoch - 1
    function massHarvest() external returns (uint256) {
        uint256 totalUserRewards;
        uint256 totalBaseRewards;
        uint256 epochId = _getEpochId().sub(1); // fails in epoch 0

        for (
            uint128 i = _lastEpochIdHarvested[msg.sender] + 1;
            i <= epochId;
            i++
        ) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            (uint256 userEpochReward, uint256 userBaseReward) = _harvest(i);
            totalUserRewards += userEpochReward;
            totalBaseRewards += userBaseReward;
        }

        emit MassHarvest(
            msg.sender,
            epochId - _lastEpochIdHarvested[msg.sender],
            totalUserRewards
        );

        _distributeTokens(totalUserRewards, totalBaseRewards);

        return totalUserRewards;
    }

    //gets the rewards for a single epoch
    function harvest(uint128 epochId) external returns (uint256) {
        // checks for requested epoch
        require(_getEpochId() > epochId, "This epoch is in the future");
        require(
            _lastEpochIdHarvested[msg.sender].add(1) == epochId,
            "Can only harvest in order"
        );
        (uint256 userEpochReward, uint256 userBaseReward) = _harvest(epochId);

        _distributeTokens(userEpochReward, userBaseReward);

        emit Harvest(msg.sender, epochId, userEpochReward);
        return userEpochReward;
    }

    /*
     * internal methods
     */

    function _harvest(uint128 epochId) internal returns (uint256, uint256) {
        // try to initialize an epoch
        if (lastInitializedEpoch < epochId) {
            _initEpoch(epochId);
        }
        // Set user state for last harvested
        _lastEpochIdHarvested[msg.sender] = epochId;

        // exit if there is no stake on the epoch
        if (_sizeAtEpoch[epochId] == 0) {
            return (0, 0);
        }

        (uint256 epochRewards, uint256 baseRewards) =
            getRewardsForEpoch(epochId, _poolLP);

        uint256 boostMultiplier = getBoost(msg.sender, epochId);

        uint256 userEpochRewards =
            epochRewards
                .mul(_getUserBalancePerEpoch(msg.sender, epochId))
                .mul(boostMultiplier) // apply boost multiplier
                .div(_sizeAtEpoch[epochId])
                .div(1 * 10**18);

        uint256 userBaseRewards =
            baseRewards.mul(_getUserBalancePerEpoch(msg.sender, epochId)).div(
                _sizeAtEpoch[epochId]
            );

        return (userEpochRewards, userBaseRewards);
    }

    function _initEpoch(uint128 epochId) internal {
        //epochs can only be harvested in order, therfore they can also only be initialised in order
        // i.e it's impossible that we init epoch 5 after 3 as to harvest 5 user needs to first harvets 4
        _sizeAtEpoch[epochId] = _getPoolSize(epochId);
        lastInitializedEpoch = epochId;
        // call the staking smart contract to init the epoch

        //Rebalance pools

        // we get the accumulated interest for the epoch
        (uint256 epochRewards, uint256 baseRewards) =
            getRewardsForEpoch(epochId, _poolLP);

        // if these pools need more rewards than base issuance, then we need to transfer it
        if (epochRewards > baseRewards) {
            uint256 transferToRewards = epochRewards.sub(baseRewards);

            _reignToken.safeTransferFrom(
                _liquidityBuffer,
                _rewardsVault,
                transferToRewards
            );
        }
    }

    function _distributeTokens(uint256 userRewards, uint256 baseRewards)
        internal
    {
        if (userRewards > 0) {
            _reignToken.safeTransferFrom(
                _rewardsVault,
                msg.sender,
                userRewards
            );
        }
        // If there are less token rewarded then base issuance
        // we transfer the difference from the rewards to the liquidty buffer
        if (baseRewards > userRewards) {
            uint256 transferToBuffer = baseRewards.sub(userRewards);
            _reignToken.safeTransferFrom(
                _rewardsVault,
                _liquidityBuffer,
                transferToBuffer
            );
        }
    }

    /*
     *   VIEWS
     */

    //returns the current epoch
    function getCurrentEpoch() external view returns (uint256) {
        return _getEpochId();
    }

    // gets the total amount of rewards accrued to a pool during an epoch
    function getRewardsForEpoch(uint128 epochId, address _pool)
        public
        view
        returns (uint256, uint256)
    {
        uint256 baseRewards =
            LibRewardsDistribution.rewardsPerEpochPerPool(
                _controller.getTargetAllocation(_pool)
            );

        uint256 epochRewards =
            (
                InterestStrategyInterface(
                    _controller.getInterestStrategy(_pool)
                )
                    .getEpochRewards(epochId)
            )
                .mul(
                LibRewardsDistribution.rewardsPerBlockPerPool(
                    _controller.getTargetAllocation(_pool)
                )
            )
                .div(10**18); //account for 18 decimals of baseRewards

        return (epochRewards, baseRewards);
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
        return _lastEpochIdHarvested[msg.sender];
    }

    // calls to the staking smart contract to retrieve the epoch total poolLP size
    function getPoolSize(uint128 epochId) external view returns (uint256) {
        return _getPoolSize(epochId);
    }

    // checks if the user has voted that epoch and returns accordingly
    function getBoost(address user, uint128 epoch)
        public
        view
        returns (uint256)
    {
        if (
            IBasketBalancer(_controller.getBasketBalancer()).hasVotedInEpoch(
                user,
                epoch
            )
        ) {
            return 1 * 10**18;
        } else {
            return 97 * 10**16; // -3%
        }
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

    // compute epoch id from blocktimestamp and
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
}
