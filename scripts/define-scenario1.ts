import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {GovRewards, InterestStrategy, PoolController, ReignDAO, ReignFacet, ReignToken} from "../typechain";
import * as helpers from "../test/helpers/governance-helpers";
import {diamondAsFacet} from "../test/helpers/diamond";
import {day, hour, minute} from "../test/helpers/time";
import {increaseBlockTime, moveAtTimestamp, stakingEpochStart} from "../test/helpers/helpers";
import * as deploy from "../test/helpers/deploy";

export class Scenario1Config {

    public amountStakedUser1?: BigNumber;
    public interestStrategy1?: InterestStrategy;
    public interestStrategy2?: InterestStrategy;

    constructor() {
    }
}

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    c.scenario1 = new Scenario1Config();

    const reignDiamondAddr = c.reignDiamond?.address as string;
    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolController = c.poolController as PoolController;
    const govRewards = c.govRewards as GovRewards;

    ///////////////////////////
    // User1 stakes ReignToken to ReignDiamond:
    ///////////////////////////
    const amountStakedUser1 = BigNumber.from(100_000).mul(helpers.tenPow18);
    c.scenario1.amountStakedUser1 = amountStakedUser1;

    console.log(`User1 approves addr '${reignDiamond.address}' to transfer '${amountStakedUser1}'`)
    await reignToken
        .connect(c.user1Acct)
        .approve(reignDiamond.address, amountStakedUser1);

    console.log(`User1 deposits '${amountStakedUser1}' to ReignDiamond`)
    await reignFacet
        .connect(c.user1Acct)
        .deposit(amountStakedUser1);

    ///////////////////////////
    // User2 stakes ReignToken to ReignDiamond:
    ///////////////////////////
    const amountStakedUser2 = BigNumber.from(100_000).mul(helpers.tenPow18);
    c.scenario1.amountStakedUser2 = amountStakedUser2;

    console.log(`User2 approves addr '${reignDiamond.address}' to transfer '${amountStakedUser2}'`)
    await reignToken
        .connect(c.user2Acct)
        .approve(reignDiamond.address, amountStakedUser2);

    console.log(`User2 deposits '${amountStakedUser2}' to ReignDiamond`)
    await reignFacet
        .connect(c.user2Acct)
        .deposit(amountStakedUser2);

    ///////////////////////////
    // User1 deploy InterestStrategy1 contract for Pool1:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            BigNumber.from(0),
        ]
    ) as InterestStrategy;
    c.scenario1.interestStrategy1 = interestStrategy1;
    console.log(`InterestStrategy1 deployed at: ${interestStrategy1.address.toLowerCase()}`);

    ///////////////////////////
    // User1 deploy InterestStrategy2 contract for Pool2:
    ///////////////////////////
    const interestStrategy2 = await deploy.deployContract(
        'InterestStrategy',
        [
            // params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            BigNumber.from(0),
        ]
    ) as InterestStrategy;
    c.scenario1.interestStrategy2 = interestStrategy2;
    console.log(`InterestStrategy2 deployed at: ${interestStrategy2.address.toLowerCase()}`);

    const targets = [
        poolController.address,
        poolController.address
    ];
    const values = ['0', '0'];
    const signatures = ['createPool(address,address,address)', 'createPool(address,address,address)'];
    const callDatas = [
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token address
                // FRAX: https://etherscan.io/token/0x853d955acef822db058eb8505911ed77f175b99e
                "0x853d955acef822db058eb8505911ed77f175b99e",
                // second param: interestStrategy
                interestStrategy1.address,
                // FRAX-USDC: https://etherscan.io/address/0x2e45c589a9f301a2061f6567b9f432690368e3c6#code
                "0x2e45c589a9f301a2061f6567b9f432690368e3c6",
            ]
        ),
        // for the second pool (Pool2):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token address
                // WETH: https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                // second param: interestStrategy
                interestStrategy2.address,
                // WETH-USDT:
                "0x2e45c589a9f301a2061f6567b9f432690368e3c6",
            ]
        ),
    ];

    console.log(`User1 proposes to create two pools.`)
    await reignDAO
        .connect(c.user1Acct)
        .propose(
            targets,
            values,
            signatures,
            callDatas,
            'Create two pools.',
            'Proposal1'
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

    ///////////////////////////
    // 'User1' executes the proposal
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .execute(proposalId);
    console.log(`User1 executes the proposal '${proposalId}'`);

    ///////////////////////////
    // Display Pool1 and Pool2 addresses
    ///////////////////////////

    let pool1Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(0);
    console.log(`Pool1 address: ${pool1Addr}`);

    let pool2Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(1);
    console.log(`Pool2 address: ${pool2Addr}`);

    // - user1 created the proposal
    // - sovreign owner votes
    // - user2 votes
    // -

    // - vote on the allocation of the pool1 and pool2
    //   -- BasketBalancer.updateAllocationVote()

    // - check if User1 has voting power
    // - BasketBalancer.updateBasketBalance()

    // - User1 deposit tokens to the Pool1
    // - User1 mint SVR (Pool.mint())
    //    -- user1 will receive SVR + LP Tokens

    // * deploy all the staking stuff

    return c;

}