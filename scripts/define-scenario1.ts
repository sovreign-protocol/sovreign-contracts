import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {BasketBalancer, GovRewards, InterestStrategy, PoolController, ReignDAO,Pool, ReignFacet, ReignToken} from "../typechain";
import * as helpers from "../test/helpers/governance-helpers";
import {diamondAsFacet} from "../test/helpers/diamond";
import {deployOracle} from "../test/helpers/oracles";
import {day, hour, minute} from "../test/helpers/time";
import {increaseBlockTime, moveAtTimestamp, stakingEpochStart, tenPow18} from "../test/helpers/helpers";
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
    const balancer = c.basketBalancer as BasketBalancer;
    const govRewards = c.govRewards as GovRewards;

    // Mainnet token contract addresses
    const WBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
    const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

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

    const oracle1 = await deployOracle(
        WBTC,
        USDC,
        reignDAO.address)
    
    console.log("WBTC Oracle deployed at: " + oracle1.address)
    await oracle1.update()
    let WBTCPrice = await oracle1.consult(WBTC,BigNumber.from(1).mul(tenPow18))
    console.log("WBTC Oracle price: " + WBTCPrice.toString())

    const oracle2 = await deployOracle(
        WETH,
        USDC,
        reignDAO.address)

    console.log("WETH Oracle deployed at: " + oracle2.address)
    await oracle2.update()
    let WETHPrice = await oracle2.consult(WETH,BigNumber.from(1).mul(tenPow18))
    console.log("WETH Oracle price: " + WETHPrice.toString())

    const targets = [
        poolController.address,
        poolController.address,
        balancer.address
    ];
    const values = ['0', '0', '0'];
    const signatures = [
        'createPool(address,address,address)', 
        'createPool(address,address,address)', 
        'setInitialAllocation(uint256[])'];
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
                // WBTC: https://etherscan.io/token/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
                WBTC,
                // second param: interestStrategy
                interestStrategy1.address,
                // third param: oracle
                oracle1.address,
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
                WETH,
                // second param: interestStrategy
                interestStrategy2.address,
                // third param: oracle
                oracle2.address,
            ]
        ),
        // for allocation:
        ejs.utils.defaultAbiCoder.encode(
            [
                'uint256[]',
            ],
            [
                [500000000,500000000],
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
    // Display Pool1 and Pool2 addresses and initial allocation
    ///////////////////////////

    let pool1Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(0);
    console.log(`Pool1 address: ${pool1Addr}`);
    let pool1Alloc = (await balancer.getTargetAllocation(pool1Addr)).toString()
    console.log(`Pool1 allocation: ${pool1Alloc}`);

    let pool2Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(1);
    console.log(`Pool2 address: ${pool2Addr}`);
    let pool2Alloc = (await balancer.getTargetAllocation(pool2Addr)).toString()
    console.log(`Pool2 allocation: ${pool2Alloc}`);


    ///////////////////////////
    // Initialize Epoch in balancer
    ///////////////////////////
    await balancer.connect(c.user1Acct).updateBasketBalance()

    ///////////////////////////
    // All Users Vote on Basket Allocation
    ///////////////////////////
    await balancer.connect(c.user1Acct).updateAllocationVote([pool1Addr,pool2Addr], [510000000,490000000])
    await balancer.connect(c.user2Acct).updateAllocationVote([pool1Addr,pool2Addr], [510000000,490000000])
    await balancer.connect(c.sovReignOwnerAcct).updateAllocationVote([pool1Addr,pool2Addr], [510000000,490000000])
    let votePool1 = await balancer.continuousVote(pool1Addr)
    console.log(`Continuous Vote Tally Pool1: ${votePool1}`);
    let votePool2 = await balancer.continuousVote(pool2Addr)
    console.log(`Continuous Vote Tally Pool2: ${votePool2}`);
    

    ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    timeWarpInSeconds = (hour/2)+100
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await moveAtTimestamp(Date.now() + timeWarpInSeconds)


    ///////////////////////////
    // Basket Allocation is updated
    ///////////////////////////
    await balancer.connect(c.user1Acct).updateBasketBalance()

    ///////////////////////////
    // Attach To deployed Pools
    ///////////////////////////
    let pool1 = (await deploy.deployContract('Pool')) as Pool;
    pool1 = pool1.attach(pool1Addr);
    console.log(`Pool1 Reserves '${ (await pool1.getReserves() ).toString()}'`)

    let pool2 = (await deploy.deployContract('Pool')) as Pool;
    pool2 = pool2.attach(pool1Addr);
    console.log(`Pool2 Reserves '${ (await pool2.getReserves() ).toString()}'`)

    


    // - check if User1 has voting power
    // - BasketBalancer.updateBasketBalance()

    // - User1 deposit tokens to the Pool1
    // - User1 mint SVR (Pool.mint())
    //    -- user1 will receive SVR + LP Tokens

    // * deploy all the staking stuff

    return c;

}