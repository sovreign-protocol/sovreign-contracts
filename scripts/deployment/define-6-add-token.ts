import {DeployConfig} from "../config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {
    BasketBalancer, 
    PoolRouter, 
    ReignDAO,
    ReignFacet, 
    ReignToken 
} from "../../typechain";
import * as helpers from "../../test/helpers/governance-helpers";
import {diamondAsFacet} from "../../test/helpers/diamond";
import {hour, minute} from "../../test/helpers/time";
import {increaseBlockTime, mineBlocks, tenPow18} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


export class Scenario1Config {

    public amountStakedUser1?: BigNumber;

    constructor() {
    }
}

export async function addToken(c: DeployConfig): Promise<DeployConfig> {


    c.scenario1 = new Scenario1Config();


    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolRouter = c.poolRouter as PoolRouter;
    const smartPool = c.smartPool as Contract;
    const basketBalancer = c.basketBalancer as BasketBalancer;
    const weth = c.weth as Contract;

    let amountWeth = BigNumber.from(20).mul(tenPow18)

    // Give DAO some tokens for proposal

    await weth.connect(c.user1Acct).transfer(reignDAO.address, amountWeth)


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


    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    let poolTokens = await poolRouter
    .getPoolTokens();
    console.log(`Token Weights before WETH is Added` );

    let weight1 = await smartPool
        .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    let weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    let weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)


    console.log(`\n --- CREATE PROPOSAL  ---`);



    const targets = [
        weth.address,
        smartPool.address,
        basketBalancer.address
    ];
    const values = ['0','0','0'];
    const signatures = [
        'approve(address,uint256)',
        'commitAddToken(address,uint256,uint256)' ,
        'addToken(address,uint256)' 
    ]
    const callDatas = [
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256'
            ],
            [
                // contract address
                smartPool.address,
                // token amount approved
                amountWeth,

            ]
        ),
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256',
                'uint256'
            ],
            [
                // token address
                c.wethAddr,
                // token amount added
                amountWeth,
                // token wight
                BigNumber.from(20).mul(BigNumber.from(10).pow(17)),

            ]
        ),
        // add token to balancer:
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'uint256',
            ],
            [
                // token address
                c.wethAddr,
                // token wight
                BigNumber.from(2).mul(tenPow18),

            ]
        )
    ];

    console.log(`User1 proposes to add WETH `)
    await reignDAO
        .connect(c.user1Acct)
        .propose(
            targets,
            values,
            signatures,
            callDatas,
            'Add WETH to Pool',
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
    // Mine Until  applyToken lock expires
    ///////////////////////////
    console.log(`Mining 256 blocks...`)
    await mineBlocks(256)


    ///////////////////////////
    // Call ApplyToken in pool
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .triggerApplyAddToken();
    console.log(`User1 triggers applyToken`);


     ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();
    console.log(`Token Weights after WETH is Added` );

    weight1 = await smartPool
        .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    let weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)

    return c;
}