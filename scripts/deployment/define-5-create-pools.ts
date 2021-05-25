import {DeployConfig} from "../config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {
    BasketBalancer, 
    InterestStrategy, 
    PoolController, 
    ChainlinkOracleAdapter, 
    ReignDAO,
    Pool, 
    ReignFacet, 
    ReignToken 
} from "../../typechain";
import * as helpers from "../../test/helpers/governance-helpers";
import {diamondAsFacet} from "../../test/helpers/diamond";
import {deployOracle} from "../../test/helpers/oracles";
import {hour, minute} from "../../test/helpers/time";
import {increaseBlockTime} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";

export class Scenario1Config {

    public amountStakedUser1?: BigNumber;
    public interestStrategy1?: InterestStrategy;
    public interestStrategy2?: InterestStrategy;

    constructor() {
    }
}

export async function createPools(c: DeployConfig): Promise<DeployConfig> {

    c.scenario1 = new Scenario1Config();

    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolController = c.poolController as PoolController;
    const balancer = c.basketBalancer as BasketBalancer;
    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;


    console.log(`\n --- USER STAKE TOKENS INTO GOVERNANCE ---`);

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


    console.log(`\n --- DEPLOY POOL DEPENDENCIES ---`);

    ///////////////////////////
    // User1 deploy InterestStrategy1 contract for Pool1:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // params were taken from the InterestStrategy.test.ts
            BigNumber.from(30).mul(10 ** 9),
            BigNumber.from(80).mul(BigNumber.from(10).pow(BigNumber.from(58))),
            c.baseDelta,
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
            BigNumber.from(30).mul(10 ** 9),
            BigNumber.from(80).mul(BigNumber.from(10).pow(BigNumber.from(58))),
            c.baseDelta,
        ]
    ) as InterestStrategy;
    c.scenario1.interestStrategy2 = interestStrategy2;
    console.log(`InterestStrategy2 deployed at: ${interestStrategy2.address.toLowerCase()}`);

    const oracle1 = await deployOracle(
        c.wethAddr,
        c.usdcAddr,
        reignDAO.address)
    c.oracle1 = oracle1
    console.log("WETH Oracle deployed at: " + oracle1.address)
    await oracle1.update()
    let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
    console.log("WETH Oracle price: " + WETHPrice.toString())

    const oracle2 = await deploy.deployContract("ChainlinkOracleAdapter", [c.btcChainlinkOracle, reignDAO.address]) as ChainlinkOracleAdapter
    c.oracle2 = oracle2
    console.log("WBTC Oracle deployed at: " + oracle2.address)
    let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))
    console.log("WBTC Oracle price: " + WBTCPrice.toString())

    



    console.log(`\n --- CREATE PROPOSAL  ---`);



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
                // WETH: https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
                c.wethAddr,
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
                // WBTC: https://etherscan.io/token/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
                c.wbtcAddr,
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

    ///////////////////////////
    // Display Pool1 and Pool2 addresses and initial allocation
    ///////////////////////////

    let pool1Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(0);
    console.log(`Pool1 created at address: ${pool1Addr}`);
    let pool1Alloc = (await balancer.getTargetAllocation(pool1Addr)).toString()
    console.log(`Pool1 allocation: ${pool1Alloc}`);

    let pool2Addr = await poolController
        .connect(c.sovReignOwnerAcct)
        .allPools(1);
    console.log(`Pool2 created at address: ${pool2Addr}`);
    let pool2Alloc = (await balancer.getTargetAllocation(pool2Addr)).toString()
    console.log(`Pool2 allocation: ${pool2Alloc}`);


    ///////////////////////////
    // Attach To deployed Pools
    ///////////////////////////
    let pool1 = (await deploy.deployContract('Pool')) as Pool;
    pool1 = pool1.attach(pool1Addr);
    c.pool1 = pool1
    console.log(`Pool1 Reserves '${ (await pool1.getReserves() ).toString()}'`)

    let pool2 = (await deploy.deployContract('Pool')) as Pool;
    pool2 = pool2.attach(pool2Addr);
    c.pool2 = pool2
    console.log(`Pool2 Reserves '${ (await pool2.getReserves() ).toString()}'`)


    return c;
}