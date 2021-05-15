import {DeployConfig} from "./config";
import {ethers as ejs} from "ethers";
import {LibRewardsDistribution, PoolRewards, Staking, PoolController, ReignDAO,Pool, ReignToken, RewardsVault, LiquidityBufferVault} from "../typechain";

import {day, hour, minute} from "../test/helpers/time";
import {increaseBlockTime} from "../test/helpers/helpers";
import * as deploy from "../test/helpers/deploy";


export async function createRewards(c: DeployConfig): Promise<DeployConfig> {


    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolController = c.poolController as PoolController;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const liquidityBuffer = c.liquidityBufferVault as LiquidityBufferVault;
    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
    


    console.log(`\n --- DEPLOY POOL REWARDS ---`);

    ///////////////////////////
    // User1 deploy PoolRewards for Pool1
    ///////////////////////////
    const pool1Rewards = await deploy.deployContract(
        'PoolRewards',
        [
            reignToken.address,
            pool1.address,
            poolController.address,
            staking.address,
            rewardsVault.address,
            liquidityBuffer.address
        ]
    ) as PoolRewards;
    c.pool1Rewards = pool1Rewards;
    console.log(`PoolRewards 1 deployed at: ${pool1Rewards.address.toLowerCase()}`);

   ///////////////////////////
    // User1 deploy PoolRewards for Pool1
    ///////////////////////////
    const pool2Rewards = await deploy.deployContract(
        'PoolRewards',
        [
            reignToken.address,
            pool2.address,
            poolController.address,
            staking.address,
            rewardsVault.address,
            liquidityBuffer.address
        ]
    ) as PoolRewards;
    c.pool2Rewards = pool2Rewards;
    console.log(`PoolRewards 2 deployed at: ${pool2Rewards.address.toLowerCase()}`);


    console.log(`\n --- CREATE PROPOSAL  ---`);



    const targets = [
        rewardsVault.address,
        rewardsVault.address,
        liquidityBuffer.address,
        liquidityBuffer.address,
    ];
    const values = ['0', '0', '0', '0'];
    const signatures = [
        'setAllowance(address,uint256)', 
        'setAllowance(address,uint256)', 
        'setAllowance(address,uint256)', 
        'setAllowance(address,uint256)', 
    ]
    const callDatas = [
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                pool1Rewards.address,
                (await tokenDistribution.POOL_TOKENS()).div(2),
            ]
        ),

        // for the second pool (Pool2):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                pool2Rewards.address,
                (await tokenDistribution.POOL_TOKENS()).div(2),
            ]
        ),
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                pool1Rewards.address,
                (await tokenDistribution.LIQUIDITY_BUFFER()).div(2),
            ]
        ),

        // for the second pool (Pool2):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                pool2Rewards.address,
                (await tokenDistribution.LIQUIDITY_BUFFER()).div(2),
            ]
        ),
    ];

    console.log(`User1 proposes to allow spending for LP Rewards`)
    await reignDAO
        .connect(c.user1Acct)
        .propose(
            targets,
            values,
            signatures,
            callDatas,
            'Allow Spending',
            'Proposal2'
        );

    ///////////////////////////
    // Time warp: go through the 'warmUpDuration'
    ///////////////////////////
    let timeWarpInSeconds = 1 * hour
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)

    ///////////////////////////
    // Get last proposal
    ///////////////////////////
    let proposalId = await reignDAO
        .connect(c.user1Acct)
        .lastProposalId();
    console.log(`Proposal created with ID: ${proposalId}`);

    ///////////////////////////
    // Time warp: go to the middle-point of the 'activeDuration'
    ///////////////////////////
    timeWarpInSeconds = (30 * minute);
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)


    console.log(`\n --- VOTING ON PROPOSAL  ---`);

    ///////////////////////////
    // 'SoVReignOwner' cast vote "true" (yes)
    // to support the created proposal
    ///////////////////////////
    await reignDAO
        .connect(c.sovReignOwnerAcct)
        .castVote(proposalId, true);
    console.log(`SoVReignOwner votes in favor of proposal '${proposalId}'`);

    ///////////////////////////
    // 'User2' cast vote "true" (yes)
    // to support the created proposal
    ///////////////////////////
    await reignDAO
        .connect(c.user2Acct)
        .castVote(proposalId, true);
    console.log(`User2 votes in favor of proposal '${proposalId}'`);

    ///////////////////////////
    // Time warp: go AFTER the 'activeDuration'
    ///////////////////////////
    timeWarpInSeconds = (1 * hour);
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)

    ///////////////////////////
    // 'User1' queues the proposal
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .queue(proposalId);
    console.log(`User1 queues the proposal '${proposalId}'`);

    // For example, here would be the time where an
    // "abrogation proposal" would be made. :-)

    ///////////////////////////
    // Time warp: go AFTER the 'gracePeriodDuration'
    ///////////////////////////
    timeWarpInSeconds = (1 * hour);
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)



    console.log(`\n --- EXECUTE PROPOSAL  ---`);

    ///////////////////////////
    // 'User1' executes the proposal
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .execute(proposalId);
    console.log(`User1 executes the proposal '${proposalId}'`);


    return c;
}