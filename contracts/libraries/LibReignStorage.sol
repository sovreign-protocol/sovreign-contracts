// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IRewards.sol";

library LibReignStorage {
    bytes32 constant STORAGE_POSITION = keccak256("ch.dialectic.reign.storage");
    struct EpochCheckpoint {
        uint128 epochId;
        uint256 amount;
    }

    struct Checkpoint {
        uint256 timestamp;
        uint256 amount;
    }

    struct Stake {
        uint128 epochId;
        uint256 timestamp;
        uint128 multiplier;
        uint256 expiryTimestamp;
        address delegatedTo;
        uint256 startBalance;
        uint256 newDeposits;
        uint256 stakingBoost;
    }

    struct Storage {
        bool initialized;
        // mapping of user address to history of Stake objects
        // every user action creates a new object in the history
        mapping(address => Stake[]) userStakeHistory;
        mapping(address => uint128) lastWithdrawEpochId;
        // array of bond staked Checkpoint
        // deposits/withdrawals create a new object in the history (max one per block)
        Checkpoint[] bondStakedHistory;
        // mapping of user address to history of delegated power
        // every delegate/stopDelegate call create a new checkpoint (max one per block)
        mapping(address => EpochCheckpoint[]) delegatedPowerHistory;
        IERC20 bond;
        IRewards rewards;
        uint256 epoch1Start;
        uint256 epochDuration;
    }

    function reignStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
