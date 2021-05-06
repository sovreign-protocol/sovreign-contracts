// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IReign.sol";
import "../libraries/LibReignStorage.sol";
import "../libraries/LibOwnership.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ReignFacet {
    using SafeMath for uint256;

    uint256 public constant MAX_LOCK = 365 days * 2;
    uint256 public constant BASE_STAKE_MULTIPLIER = 1 * 10**18;
    uint128 private constant BASE_BALANCE_MULTIPLIER = uint128(1 * 10**18);

    mapping(uint128 => bool) isInitialized;
    // holds the current balance of the user for each token
    mapping(address => uint256) balances;

    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(
        address indexed user,
        uint256 amountWithdrew,
        uint256 amountLeft
    );
    event Lock(address indexed user, uint256 timestamp);
    event Delegate(address indexed from, address indexed to);
    event DelegatedPowerIncreased(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 to_newDelegatedPower
    );
    event DelegatedPowerDecreased(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 to_newDelegatedPower
    );
    event InitEpoch(address indexed caller, uint128 indexed epochId);

    function initReign(
        address _bond,
        uint256 _start,
        uint256 _duration
    ) public {
        require(_bond != address(0), "BOND address must not be 0x0");

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();

        require(!ds.initialized, "Reign: already initialized");
        LibOwnership.enforceIsContractOwner();

        ds.initialized = true;

        ds.bond = IERC20(_bond);
        ds.epoch1Start = _start;
        ds.epochDuration = _duration;
    }

    // deposit allows a user to add more bond to his staked balance
    function deposit(uint256 amount) public {
        require(amount > 0, "Amount must be greater than 0");

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        uint256 allowance = ds.bond.allowance(msg.sender, address(this));
        require(allowance >= amount, "Token allowance too small");

        balances[msg.sender] = balances[msg.sender].add(amount);

        _increaseUserBalance(ds.userStakeHistory[msg.sender], amount);
        _updateLockedBond(bondStaked().add(amount));

        address delegatedTo = userDelegatedTo(msg.sender);
        if (delegatedTo != address(0)) {
            uint256 newDelegatedPower = delegatedPower(delegatedTo).add(amount);
            _updateDelegatedPower(
                ds.delegatedPowerHistory[delegatedTo],
                newDelegatedPower
            );

            emit DelegatedPowerIncreased(
                msg.sender,
                delegatedTo,
                amount,
                newDelegatedPower
            );
        }

        ds.bond.transferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }

    // withdraw allows a user to withdraw funds if the balance is not locked
    function withdraw(uint256 amount) public {
        require(amount > 0, "Amount must be greater than 0");
        require(
            userLockedUntil(msg.sender) <= block.timestamp,
            "User balance is locked"
        );

        uint256 balance = balanceOf(msg.sender);
        require(balance >= amount, "Insufficient balance");

        balances[msg.sender] = balances[msg.sender].sub(amount);

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();

        _decreaseUserBalance(ds.userStakeHistory[msg.sender], amount);
        _updateLockedBond(bondStaked().sub(amount));

        address delegatedTo = userDelegatedTo(msg.sender);
        if (delegatedTo != address(0)) {
            uint256 newDelegatedPower = delegatedPower(delegatedTo).sub(amount);
            _updateDelegatedPower(
                ds.delegatedPowerHistory[delegatedTo],
                newDelegatedPower
            );

            emit DelegatedPowerDecreased(
                msg.sender,
                delegatedTo,
                amount,
                newDelegatedPower
            );
        }

        ds.bond.transfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, balance.sub(amount));
    }

    // lock a user's currently staked balance until timestamp & add the bonus to his voting power
    function lock(uint256 timestamp) public {
        require(timestamp > block.timestamp, "Timestamp must be in the future");
        require(timestamp <= block.timestamp + MAX_LOCK, "Timestamp too big");
        require(balanceOf(msg.sender) > 0, "Sender has no balance");

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        LibReignStorage.Stake[] storage checkpoints =
            ds.userStakeHistory[msg.sender];
        LibReignStorage.Stake storage currentStake =
            checkpoints[checkpoints.length - 1];

        require(
            timestamp > currentStake.expiryTimestamp,
            "New timestamp lower than current lock timestamp"
        );

        _updateUserLock(checkpoints, timestamp);

        emit Lock(msg.sender, timestamp);
    }

    function depositAndLock(uint256 amount, uint256 timestamp) public {
        deposit(amount);
        lock(timestamp);
    }

    // delegate allows a user to delegate his voting power to another user
    function delegate(address to) public {
        require(msg.sender != to, "Can't delegate to self");

        uint256 senderBalance = balanceOf(msg.sender);
        require(senderBalance > 0, "No balance to delegate");

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();

        emit Delegate(msg.sender, to);

        address delegatedTo = userDelegatedTo(msg.sender);
        if (delegatedTo != address(0)) {
            uint256 newDelegatedPower =
                delegatedPower(delegatedTo).sub(senderBalance);
            _updateDelegatedPower(
                ds.delegatedPowerHistory[delegatedTo],
                newDelegatedPower
            );

            emit DelegatedPowerDecreased(
                msg.sender,
                delegatedTo,
                senderBalance,
                newDelegatedPower
            );
        }

        if (to != address(0)) {
            uint256 newDelegatedPower = delegatedPower(to).add(senderBalance);
            _updateDelegatedPower(
                ds.delegatedPowerHistory[to],
                newDelegatedPower
            );

            emit DelegatedPowerIncreased(
                msg.sender,
                to,
                senderBalance,
                newDelegatedPower
            );
        }

        _updateUserDelegatedTo(ds.userStakeHistory[msg.sender], to);
    }

    // stopDelegate allows a user to take back the delegated voting power
    function stopDelegate() public {
        return delegate(address(0));
    }

    function initEpoch(uint128 epochId) public {
        require(epochId <= getEpoch(), "can't init a future epoch");

        isInitialized[epochId] = true;

        emit InitEpoch(msg.sender, epochId);
    }

    /*
     *   VIEWS
     */

    // balanceOf returns the current BOND balance of a user (bonus not included)
    function balanceOf(address user) public view returns (uint256) {
        return balances[user];
    }

    // balanceAtTs returns the amount of BOND that the user currently staked (bonus NOT included)
    function getEpochUserBalance(address user, uint128 epochId)
        public
        view
        returns (uint256)
    {
        LibReignStorage.Stake memory stake = stakeAtEpoch(user, epochId);

        return getCheckpointEffectiveBalance(stake);
    }

    // this returns the effective balance accounting for user entering the pool after epoch start
    function getCheckpointEffectiveBalance(LibReignStorage.Stake memory c)
        internal
        pure
        returns (uint256)
    {
        return
            _getCheckpointBalance(c).mul(c.multiplier).div(
                BASE_BALANCE_MULTIPLIER
            );
    }

    // stakeAtEpoch returns the Stake object of the user that was valid at `timestamp`
    function lastStake(address user)
        public
        view
        returns (LibReignStorage.Stake memory)
    {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        LibReignStorage.Stake[] storage stakeHistory =
            ds.userStakeHistory[user];

        if (stakeHistory.length == 0) {
            return
                LibReignStorage.Stake(
                    getEpoch(),
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    block.timestamp,
                    address(0),
                    0,
                    0,
                    BASE_STAKE_MULTIPLIER
                );
        }

        return stakeHistory[stakeHistory.length - 1];
    }

    // stakeAtEpoch returns the Stake object of the user that was valid at `timestamp`
    function stakeAtEpoch(address user, uint128 epochId)
        public
        view
        returns (LibReignStorage.Stake memory)
    {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        LibReignStorage.Stake[] storage stakeHistory =
            ds.userStakeHistory[user];

        if (stakeHistory.length == 0 || epochId < stakeHistory[0].epochId) {
            return
                LibReignStorage.Stake(
                    epochId,
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    block.timestamp,
                    address(0),
                    0,
                    0,
                    BASE_STAKE_MULTIPLIER
                );
        }

        uint256 min = 0;
        uint256 max = stakeHistory.length - 1;

        if (epochId >= stakeHistory[max].epochId) {
            return stakeHistory[max];
        }

        // binary search of the value in the array
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (stakeHistory[mid].epochId <= epochId) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }

        return stakeHistory[min];
    }

    // stakeAtEpoch returns the Stake object of the user that was valid at `timestamp`
    function stakeAtTs(address user, uint256 timestamp)
        public
        view
        returns (LibReignStorage.Stake memory)
    {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        LibReignStorage.Stake[] storage stakeHistory =
            ds.userStakeHistory[user];

        if (stakeHistory.length == 0 || timestamp < stakeHistory[0].timestamp) {
            return
                LibReignStorage.Stake(
                    getEpoch(),
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    block.timestamp,
                    address(0),
                    0,
                    0,
                    BASE_STAKE_MULTIPLIER
                );
        }

        uint256 min = 0;
        uint256 max = stakeHistory.length - 1;

        if (timestamp >= stakeHistory[max].timestamp) {
            return stakeHistory[max];
        }

        // binary search of the value in the array
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (stakeHistory[mid].timestamp <= timestamp) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }

        return stakeHistory[min];
    }

    // votingPower returns the voting power (bonus included) + delegated voting power for a user at the current block
    function votingPower(address user) public view returns (uint256) {
        return votingPowerAtEpoch(user, lastStake(user).epochId);
    }

    // votingPowerAtEpoch returns the voting power (bonus included) + delegated voting power for a user at a point in time
    function votingPowerAtEpoch(address user, uint128 epochId)
        public
        view
        returns (uint256)
    {
        LibReignStorage.Stake memory stake = stakeAtEpoch(user, epochId);

        uint256 ownVotingPower;

        // if the user delegated his voting power to another user, then he doesn't have any voting power left
        if (stake.delegatedTo != address(0)) {
            ownVotingPower = 0;
        } else {
            uint256 balance = _getCheckpointBalance(stake);
            ownVotingPower = balance;
        }

        uint256 delegatedVotingPower = delegatedPowerAtEpoch(user, epochId);
        return ownVotingPower.add(delegatedVotingPower);
    }

    // votingPowerAtEpoch returns the voting power (bonus included) + delegated voting power for a user at a point in time
    function votingPowerAtTs(address user, uint256 timestamp)
        public
        view
        returns (uint256)
    {
        LibReignStorage.Stake memory stake = stakeAtTs(user, timestamp);

        uint256 ownVotingPower;

        // if the user delegated his voting power to another user, then he doesn't have any voting power left
        if (stake.delegatedTo != address(0)) {
            ownVotingPower = 0;
        } else {
            uint256 balance = _getCheckpointBalance(stake);
            ownVotingPower = balance;
        }

        uint256 delegatedVotingPower =
            delegatedPowerAtEpoch(user, stake.epochId);
        return ownVotingPower.add(delegatedVotingPower);
    }

    // bondStaked returns the total raw amount of BOND staked at the current block
    function bondStaked() public view returns (uint256) {
        return bondStakedAtTs(block.timestamp);
    }

    // bondStakedAtEpoch returns the total raw amount of BOND users have deposited into the contract
    // it does not include any bonus
    function bondStakedAtTs(uint256 timestamp) public view returns (uint256) {
        return
            _checkpointsBinarySearch(
                LibReignStorage.reignStorage().bondStakedHistory,
                timestamp
            );
    }

    // delegatedPower returns the total voting power that a user received from other users
    function delegatedPower(address user) public view returns (uint256) {
        return delegatedPowerAtEpoch(user, getEpoch());
    }

    // delegatedPowerAtEpoch returns the total voting power that a user received from other users at a point in time
    function delegatedPowerAtEpoch(address user, uint128 epoch)
        public
        view
        returns (uint256)
    {
        return
            _epochCheckpointsBinarySearch(
                LibReignStorage.reignStorage().delegatedPowerHistory[user],
                epoch
            );
    }

    // same as multiplierAtTs but for the current block timestamp
    function stakingBoost(address user) public view returns (uint256) {
        return stakingBoostAtEpoch(user, getEpoch());
    }

    // stakingBoostAtEpoch calculates the multiplier at a given epoch based on the user's stake a the given timestamp
    // it includes the decay mechanism
    function stakingBoostAtEpoch(address user, uint128 epochId)
        public
        view
        returns (uint256)
    {
        LibReignStorage.Stake memory stake = stakeAtEpoch(user, epochId);
        if (block.timestamp > stake.expiryTimestamp) {
            return BASE_STAKE_MULTIPLIER;
        }

        return stake.stakingBoost;
    }

    // userLockedUntil returns the timestamp until the user's balance is locked
    function userLockedUntil(address user) public view returns (uint256) {
        LibReignStorage.Stake memory stake = lastStake(user);

        return stake.expiryTimestamp;
    }

    // userDelegatedTo returns the address to which a user delegated their voting power; address(0) if not delegated
    function userDelegatedTo(address user) public view returns (address) {
        LibReignStorage.Stake memory stake = lastStake(user);

        return stake.delegatedTo;
    }

    // returns the last time a user interacted with the contract by deposit or withdraw
    function userLastAction(address user) public view returns (uint256) {
        LibReignStorage.Stake memory stake = lastStake(user);

        return stake.timestamp;
    }

    /*
     * Returns the id of the current epoch derived from block.timestamp
     */
    function getEpoch() public view returns (uint128) {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();

        if (block.timestamp < ds.epoch1Start) {
            return 0;
        }

        return
            uint128((block.timestamp - ds.epoch1Start) / ds.epochDuration + 1);
    }

    /*
     * Returns the percentage of time left in the current epoch
     */
    function currentEpochMultiplier() public view returns (uint128) {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        uint128 currentEpoch = getEpoch();
        uint256 currentEpochEnd =
            ds.epoch1Start + currentEpoch * ds.epochDuration;
        uint256 timeLeft = currentEpochEnd - block.timestamp;
        uint128 multiplier =
            uint128((timeLeft * BASE_BALANCE_MULTIPLIER) / ds.epochDuration);

        return multiplier;
    }

    function computeNewMultiplier(
        uint256 prevBalance,
        uint128 prevMultiplier,
        uint256 amount,
        uint128 currentMultiplier
    ) public pure returns (uint128) {
        uint256 prevAmount =
            prevBalance.mul(prevMultiplier).div(BASE_BALANCE_MULTIPLIER);
        uint256 addAmount =
            amount.mul(currentMultiplier).div(BASE_BALANCE_MULTIPLIER);
        uint128 newMultiplier =
            uint128(
                prevAmount.add(addAmount).mul(BASE_BALANCE_MULTIPLIER).div(
                    prevBalance.add(amount)
                )
            );

        return newMultiplier;
    }

    function epochIsInitialized(uint128 epochId) public view returns (bool) {
        return isInitialized[epochId];
    }

    /*
     *   INTERNAL
     */

    // _stakeMultiplier calculates the multiplier for the given lockup
    function _lockingBoost(uint256 from, uint256 to)
        internal
        pure
        returns (uint256)
    {
        uint256 diff = to.sub(from); // underflow is checked for in lock()
        if (diff >= MAX_LOCK) {
            return BASE_STAKE_MULTIPLIER.mul(2);
        }

        return
            BASE_STAKE_MULTIPLIER.add(
                diff.mul(BASE_STAKE_MULTIPLIER).div(MAX_LOCK)
            );
    }

    function _getCheckpointBalance(LibReignStorage.Stake memory c)
        internal
        pure
        returns (uint256)
    {
        return c.startBalance.add(c.newDeposits);
    }

    // _checkpointsBinarySearch executes a binary search on a list of checkpoints that's sorted chronologically
    // looking for the closest checkpoint that matches the specified timestamp
    function _checkpointsBinarySearch(
        LibReignStorage.Checkpoint[] storage checkpoints,
        uint256 timestamp
    ) internal view returns (uint256) {
        if (checkpoints.length == 0 || timestamp < checkpoints[0].timestamp) {
            return 0;
        }

        uint256 min = 0;
        uint256 max = checkpoints.length - 1;

        if (timestamp >= checkpoints[max].timestamp) {
            return checkpoints[max].amount;
        }

        // binary search of the value in the array
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (checkpoints[mid].timestamp <= timestamp) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }

        return checkpoints[min].amount;
    }

    // _checkpointsBinarySearch executes a binary search on a list of checkpoints that's sorted chronologically
    // looking for the closest checkpoint that matches the specified timestamp
    function _epochCheckpointsBinarySearch(
        LibReignStorage.EpochCheckpoint[] storage checkpoints,
        uint256 epochId
    ) internal view returns (uint256) {
        if (checkpoints.length == 0 || epochId < checkpoints[0].epochId) {
            return 0;
        }

        uint256 min = 0;
        uint256 max = checkpoints.length - 1;

        if (epochId >= checkpoints[max].epochId) {
            return checkpoints[max].amount;
        }

        // binary search of the value in the array
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (checkpoints[mid].epochId <= epochId) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }

        return checkpoints[min].amount;
    }

    // _increaseUserBalance manages an array of checkpoints
    // if there's already a checkpoint for the same timestamp, the amount is updated
    // otherwise, a new checkpoint is inserted
    function _increaseUserBalance(
        LibReignStorage.Stake[] storage stakeCheckpoints,
        uint256 amount
    ) internal {
        uint128 currentEpoch = getEpoch();
        uint128 currentMultiplier = currentEpochMultiplier();

        if (!epochIsInitialized(currentEpoch)) {
            initEpoch(currentEpoch);
        }

        // if there's no checkpoint yet, it means the user didn't have any activity
        // we want to store checkpoints both for the current epoch and next epoch because
        // if a user does a withdraw, the current epoch can also be modified and
        // we don't want to insert another checkpoint in the middle of the array as that could be expensive
        if (stakeCheckpoints.length == 0) {
            stakeCheckpoints.push(
                LibReignStorage.Stake(
                    currentEpoch,
                    block.timestamp,
                    currentMultiplier,
                    block.timestamp,
                    address(0),
                    0,
                    amount,
                    BASE_STAKE_MULTIPLIER
                )
            );

            stakeCheckpoints.push(
                LibReignStorage.Stake(
                    currentEpoch + 1, //for next epoch
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    block.timestamp,
                    address(0),
                    amount, //start balance is amount
                    0, // new deposit of amount is made
                    BASE_STAKE_MULTIPLIER
                )
            );
        } else {
            LibReignStorage.Stake storage old =
                stakeCheckpoints[stakeCheckpoints.length - 1];
            uint256 lastIndex = stakeCheckpoints.length - 1;

            // the last action happened in an older epoch (e.g. a deposit in epoch 3, current epoch is >=5)
            // add a checkpoint for the previous epoch and the current one
            if (old.epochId < currentEpoch) {
                uint128 multiplier =
                    computeNewMultiplier(
                        _getCheckpointBalance(old),
                        BASE_BALANCE_MULTIPLIER,
                        amount,
                        currentMultiplier
                    );
                //update the stake with new multiplier and amount
                stakeCheckpoints.push(
                    LibReignStorage.Stake(
                        currentEpoch,
                        block.timestamp,
                        multiplier,
                        old.expiryTimestamp,
                        old.delegatedTo,
                        _getCheckpointBalance(old),
                        amount,
                        old.stakingBoost
                    )
                );

                //add a fresh checkpoint for next epoch
                stakeCheckpoints.push(
                    LibReignStorage.Stake(
                        currentEpoch + 1,
                        block.timestamp,
                        BASE_BALANCE_MULTIPLIER,
                        old.expiryTimestamp,
                        old.delegatedTo,
                        balances[msg.sender],
                        0,
                        old.stakingBoost
                    )
                );
            }
            // the last action happened in the previous epoch, update values and add a new checkpoint
            // for the current epoch
            else if (old.epochId == currentEpoch) {
                old.multiplier = computeNewMultiplier(
                    _getCheckpointBalance(old),
                    old.multiplier,
                    amount,
                    currentMultiplier
                );
                old.newDeposits = old.newDeposits.add(amount);
                old.timestamp = block.timestamp;

                stakeCheckpoints.push(
                    LibReignStorage.Stake(
                        currentEpoch + 1,
                        block.timestamp,
                        BASE_BALANCE_MULTIPLIER,
                        old.expiryTimestamp,
                        old.delegatedTo,
                        balances[msg.sender],
                        0,
                        old.stakingBoost
                    )
                );
            }
            // the last action happened in the current epoch, just upate the value
            else {
                if (
                    lastIndex >= 1 &&
                    stakeCheckpoints[lastIndex - 1].epochId == currentEpoch
                ) {
                    stakeCheckpoints[lastIndex - 1]
                        .multiplier = computeNewMultiplier(
                        _getCheckpointBalance(stakeCheckpoints[lastIndex - 1]),
                        stakeCheckpoints[lastIndex - 1].multiplier,
                        amount,
                        currentMultiplier
                    );
                    stakeCheckpoints[lastIndex - 1]
                        .newDeposits = stakeCheckpoints[lastIndex - 1]
                        .newDeposits
                        .add(amount);

                    stakeCheckpoints[lastIndex - 1].timestamp = block.timestamp;
                }

                stakeCheckpoints[lastIndex].startBalance = balances[msg.sender];
            }
        }
    }

    // _decreaseUserBalance manages an array of checkpoints
    // if there's already a checkpoint for the same timestamp, the amount is updated
    // otherwise, a new checkpoint is inserted
    function _decreaseUserBalance(
        LibReignStorage.Stake[] storage stakeCheckpoints,
        uint256 amount
    ) internal {
        uint128 currentEpoch = getEpoch();

        if (!epochIsInitialized(currentEpoch)) {
            initEpoch(currentEpoch);
        }

        // we can't have a situation in which there is a withdraw with no checkpoint

        LibReignStorage.Stake storage old =
            stakeCheckpoints[stakeCheckpoints.length - 1];
        uint256 lastIndex = stakeCheckpoints.length - 1;

        // the last action happened in an older epoch (e.g. a deposit in epoch 3, current epoch is >=5)
        // add a checkpoint for the previous epoch and the current one
        if (old.epochId < currentEpoch) {
            //update the stake with new multiplier and amount
            stakeCheckpoints.push(
                LibReignStorage.Stake(
                    currentEpoch,
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    old.expiryTimestamp,
                    old.delegatedTo,
                    balances[msg.sender],
                    0,
                    old.stakingBoost
                )
            );
        }
        // there was a deposit in the `epochId - 1` epoch => we have a checkpoint for the current epoch
        else if (old.epochId == currentEpoch) {
            old.multiplier = BASE_BALANCE_MULTIPLIER;
            old.startBalance = balances[msg.sender];
            old.newDeposits = 0;
            old.timestamp = block.timestamp;
        }
        // there was a deposit in the current epoch
        else {
            LibReignStorage.Stake storage currentEpochCheckpoint =
                stakeCheckpoints[lastIndex - 1];

            uint256 balanceBefore =
                getCheckpointEffectiveBalance(currentEpochCheckpoint);
            // in case of withdraw, we have 2 branches:
            // 1. the user withdraws less than he added in the current epoch
            // 2. the user withdraws more than he added in the current epoch (including 0)
            if (amount < currentEpochCheckpoint.newDeposits) {
                uint128 avgDepositMultiplier =
                    uint128(
                        balanceBefore
                            .sub(currentEpochCheckpoint.startBalance)
                            .mul(BASE_BALANCE_MULTIPLIER)
                            .div(currentEpochCheckpoint.newDeposits)
                    );

                currentEpochCheckpoint.newDeposits = currentEpochCheckpoint
                    .newDeposits
                    .sub(amount);

                currentEpochCheckpoint.multiplier = computeNewMultiplier(
                    currentEpochCheckpoint.startBalance,
                    BASE_BALANCE_MULTIPLIER,
                    currentEpochCheckpoint.newDeposits,
                    avgDepositMultiplier
                );
            } else {
                currentEpochCheckpoint.startBalance = currentEpochCheckpoint
                    .startBalance
                    .sub(amount.sub(currentEpochCheckpoint.newDeposits));
                currentEpochCheckpoint.newDeposits = 0;
                currentEpochCheckpoint.multiplier = BASE_BALANCE_MULTIPLIER;
            }

            stakeCheckpoints[lastIndex].startBalance = balances[msg.sender];
        }
    }

    // _updateUserLock updates the expiry timestamp on the user's stake
    // it assumes that if the user already has a balance, which is checked for in the lock function
    // then there must be at least 1 checkpoint
    function _updateUserLock(
        LibReignStorage.Stake[] storage checkpoints,
        uint256 expiryTimestamp
    ) internal {
        uint128 epochId = getEpoch();
        LibReignStorage.Stake storage old = checkpoints[checkpoints.length - 1];

        //if there is no checkpoint this epoch make a new one with updated lock
        if (old.epochId < epochId) {
            checkpoints.push(
                LibReignStorage.Stake(
                    epochId,
                    block.timestamp,
                    BASE_BALANCE_MULTIPLIER,
                    expiryTimestamp,
                    old.delegatedTo,
                    _getCheckpointBalance(old),
                    0,
                    _lockingBoost(block.timestamp, expiryTimestamp)
                )
            );
            //else if the last one is the current checkpoint update its
        } else if (old.epochId == epochId) {
            old.expiryTimestamp = expiryTimestamp;
            old.stakingBoost = _lockingBoost(block.timestamp, expiryTimestamp);
        }
        //else we had a deposit that created a checkpoint for next epoch, so we update both
        else {
            old.expiryTimestamp = expiryTimestamp;
            old.stakingBoost = _lockingBoost(block.timestamp, expiryTimestamp);

            LibReignStorage.Stake storage previous =
                checkpoints[checkpoints.length - 2];

            previous.expiryTimestamp = expiryTimestamp;
            previous.stakingBoost = _lockingBoost(
                block.timestamp,
                expiryTimestamp
            );
        }
    }

    // _updateUserDelegatedTo updates the delegateTo property on the user's stake
    // it assumes that if the user already has a balance, which is checked for in the delegate function
    // then there must be at least 1 checkpoint
    function _updateUserDelegatedTo(
        LibReignStorage.Stake[] storage checkpoints,
        address to
    ) internal {
        uint128 epochId = getEpoch();
        LibReignStorage.Stake storage old = checkpoints[checkpoints.length - 1];

        //if there is no checkpoint this epoch make a new one with updated delegation
        if (old.epochId < epochId) {
            checkpoints.push(
                LibReignStorage.Stake(
                    epochId,
                    block.timestamp,
                    old.multiplier,
                    old.expiryTimestamp,
                    to,
                    _getCheckpointBalance(old),
                    0,
                    old.stakingBoost
                )
            );
            //else if the last one is the current checkpoint update its
        } else if (old.epochId == epochId) {
            old.delegatedTo = to;
        }
        //else we had a deposit that created a checkpoint for next epoch, so we update both
        else {
            old.delegatedTo = to;

            LibReignStorage.Stake storage previous =
                checkpoints[checkpoints.length - 2];
            previous.delegatedTo = to;
        }
    }

    // _updateDelegatedPower updates the power delegated TO the user in the checkpoints history
    function _updateDelegatedPower(
        LibReignStorage.EpochCheckpoint[] storage checkpoints,
        uint256 amount
    ) internal {
        if (
            checkpoints.length == 0 ||
            checkpoints[checkpoints.length - 1].epochId < getEpoch()
        ) {
            checkpoints.push(
                LibReignStorage.EpochCheckpoint(getEpoch(), amount)
            );
        } else {
            LibReignStorage.EpochCheckpoint storage old =
                checkpoints[checkpoints.length - 1];
            old.amount = amount;
        }
    }

    // _updateLockedBond stores the new `amount` into the BOND locked history
    function _updateLockedBond(uint256 amount) internal {
        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();

        if (
            ds.bondStakedHistory.length == 0 ||
            ds.bondStakedHistory[ds.bondStakedHistory.length - 1].timestamp <
            block.timestamp
        ) {
            ds.bondStakedHistory.push(
                LibReignStorage.Checkpoint(block.timestamp, amount)
            );
        } else {
            LibReignStorage.Checkpoint storage old =
                ds.bondStakedHistory[ds.bondStakedHistory.length - 1];
            old.amount = amount;
        }
    }
}
