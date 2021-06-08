// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IWrapSVR.sol";
import "../interfaces/IBasketBalancer.sol";
import "../interfaces/IReignPoolRewards.sol";
import "../libraries/LibRewardsDistribution.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract WrappingRewards {
    // lib
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    // state variables

    // addreses
    address public treasoury;
    address private _rewardsVault;
    address private _balancer;
    // contracts
    IERC20 private _reignToken;
    IWrapSVR private _wrapper;

    uint256 BASE_MULTIPLIER = 10**18;
    uint256 public NO_BOOST_PENALTY = 3 * 10**16; // -3%

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

    event InitEpoch(address indexed caller, uint128 indexed epochId);

    // constructor
    constructor(
        address reignTokenAddress,
        address balancer,
        address wrappingContract,
        address rewardsVault,
        address _treasury
    ) {
        _reignToken = IERC20(reignTokenAddress);
        _wrapper = IWrapSVR(wrappingContract);
        _rewardsVault = rewardsVault;
        _balancer = balancer;
        epochDuration = _wrapper.epochDuration();
        epochStart = _wrapper.epoch1Start() + epochDuration;
        treasoury = _treasury;
    }

    // public method to harvest all the unharvested epochs until current epoch - 1
    function massHarvest() external returns (uint256) {
        uint256 totalDistributedValue;
        uint256 epochId = _getEpochId().sub(1); // fails in epoch 0

        for (
            uint128 i = _lastEpochIdHarvested[msg.sender] + 1;
            i <= epochId;
            i++
        ) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            totalDistributedValue += _harvest(i);
        }

        if (totalDistributedValue > 0) {
            _reignToken.safeTransferFrom(
                _rewardsVault,
                msg.sender,
                totalDistributedValue
            );
        }

        emit MassHarvest(
            msg.sender,
            epochId - _lastEpochIdHarvested[msg.sender],
            totalDistributedValue
        );

        return totalDistributedValue;
    }

    //gets the rewards for a single epoch
    function harvest(uint128 epochId) external returns (uint256) {
        // checks for requested epoch
        require(_getEpochId() > epochId, "This epoch is in the future");
        require(
            _lastEpochIdHarvested[msg.sender].add(1) == epochId,
            "Can only harvest in order"
        );

        uint256 userReward = _harvest(epochId);
        if (userReward > 0) {
            _reignToken.safeTransferFrom(_rewardsVault, msg.sender, userReward);
        }

        emit Harvest(msg.sender, epochId, userReward);
        return userReward;
    }

    // transfer the entire fees collected in this contract to DAO treasoury
    function collectFeesToDAO() public {
        uint256 balance = IERC20(_reignToken).balanceOf(address(this));
        IERC20(_reignToken).transfer(treasoury, balance);
    }

    /*
     * internal methods
     */

    function _harvest(uint128 epochId) internal returns (uint256) {
        // try to initialize an epoch
        if (lastInitializedEpoch < epochId) {
            _initEpoch(epochId);
        }
        // Set user state for last harvested
        _lastEpochIdHarvested[msg.sender] = epochId;

        // exit if there is no stake on the epoch
        if (_sizeAtEpoch[epochId] == 0) {
            return 0;
        }

        uint256 epochRewards = getRewardsForEpoch(epochId);
        bool boost = isBoosted(msg.sender, epochId);

        // get users share of rewards
        uint256 userEpochRewards =
            epochRewards.mul(_getUserBalancePerEpoch(msg.sender, epochId)).div(
                _sizeAtEpoch[epochId]
            );

        //if user is not boosted pull penalty into this contract and reduce user rewards
        if (!boost) {
            uint256 penalty =
                userEpochRewards.mul(NO_BOOST_PENALTY).div(BASE_MULTIPLIER); // decrease by 3%

            userEpochRewards = userEpochRewards.sub(penalty);

            _reignToken.safeTransferFrom(_rewardsVault, address(this), penalty);
        }

        return userEpochRewards;
    }

    function _initEpoch(uint128 epochId) internal {
        //epochs can only be harvested in order, therfore they can also only be initialised in order
        // i.e it's impossible that we init epoch 5 after 3 as to harvest 5 user needs to first harvets 4
        _sizeAtEpoch[epochId] = _getPoolSize(epochId);
        lastInitializedEpoch = epochId;
        // call the staking smart contract to init the epoch

        emit InitEpoch(msg.sender, epochId);
    }

    /*
     *   VIEWS
     */

    //returns the current epoch
    function getCurrentEpoch() external view returns (uint256) {
        return _getEpochId();
    }

    // gets the total amount of rewards accrued to a pool during an epoch
    function getRewardsForEpoch(uint128 epochId) public view returns (uint256) {
        uint256 epochRewards =
            LibRewardsDistribution.wrappingRewardsPerEpochTotal(epochStart);
        return epochRewards;
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
    function isBoosted(address user, uint128 epoch) public view returns (bool) {
        IBasketBalancer balancer = IBasketBalancer(_balancer);
        address _reign = balancer.reignAddress();
        // if user or users delegate has voted
        if (
            balancer.hasVotedInEpoch(
                user,
                epoch + 1 // balancer epoch is 1 higher then pool
            ) ||
            balancer.hasVotedInEpoch(
                IReignPoolRewards(_reign).userDelegatedTo(user),
                epoch + 1 // _balancer epoch is 1 higher then pool
            )
        ) {
            return true;
        } else {
            return false; // -3%
        }
    }

    function _getPoolSize(uint128 epochId) internal view returns (uint256) {
        // retrieve unilp token balance
        return _wrapper.getEpochPoolSize(_wrapperEpochId(epochId));
    }

    function _getUserBalancePerEpoch(address userAddress, uint128 epochId)
        internal
        view
        returns (uint256)
    {
        // retrieve unilp token balance per user per epoch
        return
            _wrapper.getEpochUserBalance(userAddress, _wrapperEpochId(epochId));
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
    function _wrapperEpochId(uint128 epochId) internal pure returns (uint128) {
        return epochId + 1;
    }
}
