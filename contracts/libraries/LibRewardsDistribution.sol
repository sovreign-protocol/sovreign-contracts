// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/math/SafeMath.sol";

contract RewardsPeriod {
    using SafeMath for uint256;

    uint256 TOKENS_FIRST_PERIOD = 50000000 * 10**18;

    uint256 HALVING_PERIOD = 62899200; // 104 Weeks in Seconds
    uint256 EPOCH_LENGTH = 604800; // One Week in Seconds
    uint256 EPOCHS_IN_PERIOD = 104; // One Week in Seconds

    uint256 TOTAL_ALLOCATION = 1000000;

    uint256 epoch1Start;

    constructor(uint256 _epoch1Start) {
        epoch1Start = _epoch1Start;
    }

    function rewardsPerEpochPerPool(uint256 poolAllocation)
        public
        view
        returns (uint256)
    {
        return rewardsPerEpochTotal().mul(poolAllocation).div(TOTAL_ALLOCATION);
    }

    function rewardsPerEpochTotal() public view returns (uint256) {
        return rewardsPerPeriodTotal() / EPOCHS_IN_PERIOD;
    }

    function rewardsPerPeriodTotal() public view returns (uint256) {
        uint256 _timeElapsed = (block.timestamp.sub(epoch1Start));
        uint256 _periodNr = (_timeElapsed / HALVING_PERIOD).add(1); // this creates the 2 year step function
        return TOKENS_FIRST_PERIOD.div(2 * _periodNr);
    }
}
