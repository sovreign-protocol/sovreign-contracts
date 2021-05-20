// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

library LibRewardsDistribution {
    using SafeMath for uint256;

    uint256 public constant TOTAL_REIGN_SUPPLY = 1000000000 * 10**18;

    uint256 public constant TREASURY = 60000000 * 10**18;
    uint256 public constant TEAM = 140000000 * 10**18;
    uint256 public constant TREASURY_SALE = 90000000 * 10**18;
    uint256 public constant DEV_FUND = 50000000 * 10**18;
    uint256 public constant LIQUIDITY_BUFFER = 20000000 * 10**18;
    uint256 public constant POOL_TOKENS = 500000000 * 10**18;
    uint256 public constant STAKING_TOKENS = 100000000 * 10**18;
    uint256 public constant LP_REWARDS_TOKENS = 40000000 * 10**18;

    uint256 public constant HALVING_PERIOD = 62899200; // 104 Weeks in Seconds
    uint256 public constant EPOCHS_IN_PERIOD = 104; // Weeks in 2 years
    uint256 public constant BLOCKS_IN_PERIOD = 2300000 * 2;
    uint256 public constant BLOCKS_IN_EPOCH = 44230;

    uint256 public constant TOTAL_ALLOCATION = 1000000000;

    /*
     *   POOL
     */

    function rewardsPerEpochPerPool(uint256 poolAllocation, uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        return
            poolRewardsPerEpochTotal(epoch1start).mul(poolAllocation).div(
                TOTAL_ALLOCATION
            );
    }

    function rewardsPerBlockPerPool(uint256 poolAllocation, uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        return
            poolRewardsPerBlockTotal(epoch1start).mul(poolAllocation).div(
                TOTAL_ALLOCATION
            );
    }

    function poolRewardsPerEpochTotal(uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        return poolRewardsPerPeriodTotal(epoch1start) / EPOCHS_IN_PERIOD;
    }

    function poolRewardsPerBlockTotal(uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        return poolRewardsPerPeriodTotal(epoch1start) / BLOCKS_IN_PERIOD;
    }

    function poolRewardsPerPeriodTotal(uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        uint256 _timeElapsed = (block.timestamp.sub(epoch1start));
        uint256 _periodNr = (_timeElapsed / HALVING_PERIOD).add(1); // this creates the 2 year step function
        return POOL_TOKENS.div(2 * _periodNr);
    }

    /*
     *   GOV STAKING
     */

    function rewardsPerEpochStaking(uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        return stakingRewardsPerPeriodTotal(epoch1start) / EPOCHS_IN_PERIOD;
    }

    function stakingRewardsPerPeriodTotal(uint256 epoch1start)
        internal
        view
        returns (uint256)
    {
        if (epoch1start > block.timestamp) {
            return 0;
        }
        uint256 _timeElapsed = (block.timestamp.sub(epoch1start));
        uint256 _periodNr = (_timeElapsed / HALVING_PERIOD).add(1); // this creates the 2 year step function
        return STAKING_TOKENS.div(2 * _periodNr);
    }

    /*
     *   LP REWARDS
     */

    function rewardsPerEpochLPRewards(uint256 nrOfEpochs)
        internal
        view
        returns (uint256)
    {
        return LP_REWARDS_TOKENS / nrOfEpochs;
    }
}
