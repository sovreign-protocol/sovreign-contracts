// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/math/SafeMath.sol";

library LibRewardsDistribution {
    using SafeMath for uint256;

    uint256 constant TOKENS_FIRST_PERIOD = 50000000 * 10**18;

    uint256 constant HALVING_PERIOD = 62899200; // 104 Weeks in Seconds
    uint256 constant EPOCH_LENGTH = 604800; // One Week in Seconds
    uint256 constant EPOCHS_IN_PERIOD = 104;
    uint256 constant BLOCKS_IN_PERIOD = 2300000 * 2;
    uint256 constant BLOCKS_IN_EPOCH = 44230;
    uint256 constant TOTAL_ALLOCATION = 1000000000;
    uint256 constant EPOCH_1_START = 1619533277;

    function rewardsPerEpochPerPool(uint256 poolAllocation)
        internal
        view
        returns (uint256)
    {
        return rewardsPerEpochTotal().mul(poolAllocation).div(TOTAL_ALLOCATION);
    }

    function rewardsPerBlockPerPool(uint256 poolAllocation)
        internal
        view
        returns (uint256)
    {
        return rewardsPerBlockTotal().mul(poolAllocation).div(TOTAL_ALLOCATION);
    }

    function rewardsPerEpochTotal() internal view returns (uint256) {
        return rewardsPerPeriodTotal() / EPOCHS_IN_PERIOD;
    }

    function rewardsPerEpochStaking() internal pure returns (uint256) {
        return (1000000 * 10**18) / EPOCHS_IN_PERIOD;
    }

    function rewardsPerBlockTotal() internal view returns (uint256) {
        return rewardsPerPeriodTotal() / BLOCKS_IN_PERIOD;
    }

    function rewardsPerPeriodTotal() internal view returns (uint256) {
        uint256 _timeElapsed = (block.timestamp.sub(EPOCH_1_START));
        uint256 _periodNr = (_timeElapsed / HALVING_PERIOD).add(1); // this creates the 2 year step function
        return TOKENS_FIRST_PERIOD.div(2 * _periodNr);
    }
}
