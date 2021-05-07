// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IStaking.sol";

contract LPRewards {
    // lib
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    // constants
    uint256 public constant TOTAL_DISTRIBUTED_AMOUNT = 2000000;
    uint256 public constant NR_OF_EPOCHS = 100;

    // state variables

    // addreses
    address private _depositLP;
    address private _communityVault;
    // contracts
    IERC20 private _reignToken;
    IStaking private _staking;

    uint256[] private sizeAtEpoch = new uint256[](NR_OF_EPOCHS + 1);
    uint256 private _totalAmountPerEpoch;
    uint128 public lastInitializedEpoch;
    mapping(address => uint128) private lastEpochIdHarvested;
    uint256 public epochDuration; // init from staking contract
    uint256 public epochStart; // init from staking contract

    // events
    event MassHarvest(
        address indexed user,
        uint256 sizeAtEpochHarvested,
        uint256 totalValue
    );
    event Harvest(
        address indexed user,
        uint128 indexed epochId,
        uint256 amount
    );

    // constructor
    constructor(
        address bondTokenAddress,
        address depositLP,
        address stakeContract,
        address communityVault
    ) {
        _reignToken = IERC20(bondTokenAddress);
        _depositLP = depositLP;
        _staking = IStaking(stakeContract);
        _communityVault = communityVault;
        epochDuration = _staking.EPOCH_DURATION();
        epochStart = _staking.epoch1Start() + epochDuration;
        _totalAmountPerEpoch = TOTAL_DISTRIBUTED_AMOUNT.mul(10**18).div(
            NR_OF_EPOCHS
        );
    }

    // public methods
    // public method to harvest all the unharvested sizeAtEpoch until current epoch - 1
    function massHarvest() external returns (uint256) {
        uint256 totalDistributedValue;
        uint256 epochId = _getEpochId().sub(1); // fails in epoch 0
        // force max number of sizeAtEpoch
        if (epochId > NR_OF_EPOCHS) {
            epochId = NR_OF_EPOCHS;
        }

        for (
            uint128 i = lastEpochIdHarvested[msg.sender] + 1;
            i <= epochId;
            i++
        ) {
            // i = epochId
            // compute distributed Value and do one single transfer at the end
            totalDistributedValue += _harvest(i);
        }

        emit MassHarvest(
            msg.sender,
            epochId - lastEpochIdHarvested[msg.sender],
            totalDistributedValue
        );

        if (totalDistributedValue > 0) {
            _reignToken.safeTransferFrom(
                _communityVault,
                msg.sender,
                totalDistributedValue
            );
        }

        return totalDistributedValue;
    }

    function harvest(uint128 epochId) external returns (uint256) {
        // checks for requested epoch
        require(_getEpochId() > epochId, "This epoch is in the future");
        require(
            epochId <= NR_OF_EPOCHS,
            "Maximum number of sizeAtEpoch is 100"
        );
        require(
            lastEpochIdHarvested[msg.sender].add(1) == epochId,
            "Harvest in order"
        );
        uint256 userReward = _harvest(epochId);
        if (userReward > 0) {
            _reignToken.safeTransferFrom(
                _communityVault,
                msg.sender,
                userReward
            );
        }
        emit Harvest(msg.sender, epochId, userReward);
        return userReward;
    }

    // views
    // calls to the staking smart contract to retrieve the epoch total pool size
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
        sizeAtEpoch[epochId] = _getPoolSize(epochId);
    }

    function _harvest(uint128 epochId) internal returns (uint256) {
        // try to initialize an epoch. if it can't it fails
        // if it fails either user either a BarnBridge account will init not init sizeAtEpoch
        if (lastInitializedEpoch < epochId) {
            _initEpoch(epochId);
        }
        // Set user state for last harvested
        lastEpochIdHarvested[msg.sender] = epochId;
        // compute and return user total reward. For optimization reasons the transfer have been moved to an upper layer (i.e. massHarvest needs to do a single transfer)

        // exit if there is no stake on the epoch
        if (sizeAtEpoch[epochId] == 0) {
            return 0;
        }
        return
            _totalAmountPerEpoch
                .mul(_getUserBalancePerEpoch(msg.sender, epochId))
                .div(sizeAtEpoch[epochId]);
    }

    function _getPoolSize(uint128 epochId) internal view returns (uint256) {
        // retrieve unilp token balance
        return _staking.getEpochPoolSize(_depositLP, _stakingEpochId(epochId));
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
                _depositLP,
                _stakingEpochId(epochId)
            );
    }

    // compute epoch id from blocktimestamp and sizeAtEpochtart date
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
