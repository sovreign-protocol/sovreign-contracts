// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.1;

import "../interfaces/IReign.sol";

contract ReignDAOReignMock {
    uint256 private _reignStaked;
    mapping(address => uint256) private _votingPowerAtTs;
    bool public lockCreatorBalanceHasBeenCalled;
    bool public withdrawHasBeenCalled;

    // votingPowerAtTs returns the voting power (bonus included) + delegated voting power for a user at a point in time
    function votingPowerAtTs(address user, uint256 timestamp)
        external
        view
        returns (uint256)
    {
        return _votingPowerAtTs[user];
    }

    function votingPower(address user) external view returns (uint256) {
        return _votingPowerAtTs[user];
    }

    function reignStaked() external view returns (uint256) {
        return _reignStaked;
    }

    function reignStakedAtTs(uint256 ts) public view returns (uint256) {
        return _reignStaked;
    }

    function setBondStaked(uint256 val) public {
        _reignStaked = val;
    }

    function setVotingPower(address user, uint256 val) public {
        _votingPowerAtTs[user] = val;
    }

    function withdraw(uint256 amount) external {
        withdrawHasBeenCalled = true;
    }
}
