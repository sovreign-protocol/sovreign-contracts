// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.1;

import "../interfaces/IReignPoolRewards.sol";

contract ReignBalancerMock {
    function userDelegatedTo(address user) external view returns (address) {
        return address(0);
    }
}
