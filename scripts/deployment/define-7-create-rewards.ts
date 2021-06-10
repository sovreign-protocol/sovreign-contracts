import {DeployConfig} from "../config";
import {ethers as ejs, Contract} from "ethers";
import {
    LibRewardsDistribution,
    Staking, 
    ReignDAO,
    ReignToken, 
    RewardsVault,
    SovWrapper,
    WrappingRewards,
    BasketBalancer, 
    } from "../../typechain";

import {hour, minute} from "../../test/helpers/time";
import {increaseBlockTime} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


export async function createRewards(c: DeployConfig): Promise<DeployConfig> {


    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const sovWrapper = c.sovWrapper as SovWrapper;
    const reignDAO = c.reignDAO as ReignDAO;
    const basketBalancer = c.basketBalancer as BasketBalancer;
    const rewardsVault = c.rewardsVault as RewardsVault;


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
    

    console.log(`\n --- DEPLOY REWARDS ---`);

    ///////////////////////////
    // User1 deploy PoolRewards for Pool1
    ///////////////////////////
    const wrappingRewards = await deploy.deployContract(
        'WrappingRewards',
        [
            reignToken.address,
            basketBalancer.address,
            sovWrapper.address,
            rewardsVault.address,
            reignDiamond.address
        ]
    ) as WrappingRewards;
    c.wrappingRewards = wrappingRewards;
    console.log(`WrappingRewards deployed at: ${wrappingRewards.address.toLowerCase()}`);

  


    console.log(`\n --- CREATE PROPOSAL  ---`);

    const targets = [
        rewardsVault.address,
    ];
    const values = ['0'];
    const signatures = [
        'setAllowance(address,uint256)', 
    ]
    const callDatas = [
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                wrappingRewards.address,
                (await tokenDistribution.WRAPPING_TOKENS()),
            ]
        ),
    ];

    console.log(`User1 proposes to allow spending for Wrapping Rewards`)
    await reignDAO
        .connect(c.user1Acct)
        .propose(
            targets,
            values,
            signatures,
            callDatas,
            'Allow Spending for Wrapping',
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