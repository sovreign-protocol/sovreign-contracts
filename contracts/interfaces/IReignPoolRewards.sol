// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface IReignPoolRewards {
    // userDidDelegate returns the address to which a user delegated their voting power; address(0) if not delegated
    function userDelegatedTo(address user) external view returns (address);
}
