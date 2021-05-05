// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IRewards.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ReignMock {
    using SafeMath for uint256;

    IRewards public r;
    uint256 public bondStaked;
    mapping(address => uint256) private balances;

    mapping(address => uint256) private lastAction;
    mapping(address => uint256) private lockedUntill;
    mapping(address => uint256) private lockedAt;

    uint256 public constant MAX_LOCK = 365 days;
    uint256 public constant BASE_MULTIPLIER = 1e18;

    function setRewards(address rewards) public {
        r = IRewards(rewards);
    }

    function callRegisterUserAction(address user) public {
        return r.registerUserAction(user);
    }

    function deposit(address user, uint256 amount) public {
        callRegisterUserAction(user);
        lastAction[user] = block.timestamp;

        balances[user] = balances[user] + amount;
        bondStaked = bondStaked + amount;
    }

    function lock(address user, uint256 timestamp) public {
        lockedUntill[user] = timestamp;
        lockedAt[user] = block.timestamp;
    }

    function withdraw(address user, uint256 amount) public {
        require(balances[user] >= amount, "insufficient balance");

        callRegisterUserAction(user);
        lastAction[user] = block.timestamp;

        balances[user] = balances[user] - amount;
        bondStaked = bondStaked - amount;
    }

    function balanceOf(address user) public view returns (uint256) {
        return balances[user];
    }

    function multiplierOf(address user) public view returns (uint256) {
        uint256 diff = lockedUntill[user] - lockedAt[user];
        if (diff >= MAX_LOCK) {
            return BASE_MULTIPLIER.mul(2);
        }

        return BASE_MULTIPLIER.add(diff.mul(BASE_MULTIPLIER).div(MAX_LOCK));
    }

    // returns the last time a user interacted with the contract
    function userLastAction(address user) public view returns (uint256) {
        return lastAction[user];
    }

    function votingPowerAtTs(address user, uint256 ts)
        public
        view
        returns (uint256)
    {
        return balances[user];
    }
}
