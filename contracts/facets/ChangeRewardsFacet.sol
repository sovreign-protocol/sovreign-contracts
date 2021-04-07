// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibReignStorage.sol";
import "../libraries/LibOwnership.sol";

contract ChangeRewardsFacet {
    function changeRewardsAddress(address _rewards) public {
        LibOwnership.enforceIsContractOwner();

        LibReignStorage.Storage storage ds = LibReignStorage.reignStorage();
        ds.rewards = IRewards(_rewards);
    }
}
