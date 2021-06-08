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
import {day, minute} from "../../test/helpers/time";
import {increaseBlockTime, mineBlocks, tenPow18} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


export class Scenario1Config {

    public amountStakedUser1?: BigNumber;

    constructor() {
    }
}
export async function updateWeights(c: DeployConfig): Promise<DeployConfig> {

    c.scenario1 = new Scenario1Config();

    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as ReignFacet;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolRouter = c.poolRouter as PoolRouter;
    const smartPool = c.smartPool as Contract;
    const basketBalancer = c.basketBalancer as BasketBalancer;
   


    console.log(`\n --- PREPARE EPOCH FOR VOTING ---`);

    ///////////////////////////
    // Time warp: go after the  current epoch ends
    ///////////////////////////
    let timeWarpInSeconds = (8 * day);
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)

    ///////////////////////////
    // 'User1' executes the update for the previous epoch
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .triggerWeightUpdate();
    console.log(`User1 triggers weight epoch 1`);

    ///////////////////////////
    // 'User1' executes the update for the previous epoch
    ///////////////////////////
    console.log(`Mining 13300 blocks to elapse update period...`)
    await mineBlocks(13300)

    await smartPool.pokeWeights()

    console.log(`\n --- USER VOTE ON NEW WEIGHTS ---`);



    await basketBalancer.connect(c.user1Acct).updateAllocationVote(
        [c.wbtcAddr,c.usdcAddr,c.daiAddr,c.wethAddr],
        [
            BigNumber.from(125).mul(BigNumber.from(10).pow(17)), 
            BigNumber.from(125).mul(BigNumber.from(10).pow(17)), 
            BigNumber.from(125).mul(BigNumber.from(10).pow(17)),
            BigNumber.from(35).mul(BigNumber.from(10).pow(17))
        ]
    )
    console.log(`User 1 Voted on Allocation`)


    await basketBalancer.connect(c.user2Acct).updateAllocationVote(
        [c.wbtcAddr,c.usdcAddr,c.daiAddr,c.wethAddr],
        [
            BigNumber.from(130).mul(BigNumber.from(10).pow(17)), 
            BigNumber.from(122).mul(BigNumber.from(10).pow(17)), 
            BigNumber.from(128).mul(BigNumber.from(10).pow(17)),
            BigNumber.from(30).mul(BigNumber.from(10).pow(17))
        ]
    )
    console.log(`User 2 Voted on Allocation`)

    ///////////////////////////
    // Time warp: go AFTER the epoch ends
    ///////////////////////////
    timeWarpInSeconds = (7 * day);
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)



    console.log(`\n --- EXECUTE UPDATE  ---`);

    ///////////////////////////
    // 'User1' executes the update
    ///////////////////////////
    await reignDAO
        .connect(c.user1Acct)
        .triggerWeightUpdate();
    console.log(`User1 triggers weight update in epoch 2`);

    let poolTokens = await poolRouter
    .getPoolTokens();
    console.log(`Target Weights for update` );

    let weight1 = await basketBalancer
        .getTargetAllocation(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' target Weight`)

    let weight2 = await basketBalancer
        .getTargetAllocation(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' target Weight`)

    let weight3 = await basketBalancer
        .getTargetAllocation(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' target Weight`)

    let weight4 = await basketBalancer
        .getTargetAllocation(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' target Weight`)


    

    console.log(`\n --- START POKE WEIGHTS FOR INCREMENTAL UPDATE  ---`);



    ///////////////////////////
    // Mine a few blocks and pokeWeights
    ///////////////////////////
    console.log(`Mining 256 blocks...`)
    await mineBlocks(256)

    await smartPool.pokeWeights()

    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();

    weight1 = await smartPool
        .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)


    ///////////////////////////
    // Mine a few blocks and pokeWeights
    ///////////////////////////
    console.log(`Mining 256 blocks...`)
    await mineBlocks(256)

    await smartPool.pokeWeights()

    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();

    weight1 = await smartPool
        .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)



    ///////////////////////////
    // Mine a few blocks and pokeWeights
    ///////////////////////////
    console.log(`Mining 256 blocks...`)
    await mineBlocks(256)

    await smartPool.pokeWeights()

    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();

    weight1 = await smartPool
        .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)



    ///////////////////////////
    // Mine a few blocks and pokeWeights
    ///////////////////////////
    console.log(`Mining 256 blocks...`)
    await mineBlocks(256)

    await smartPool.pokeWeights()

    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();

    weight1 = await smartPool
    .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)


    ///////////////////////////
    // Move to end of update period
    ///////////////////////////
    console.log(`Mining 13300 blocks to elapse update period...`)
    await mineBlocks(13300)

    await smartPool.pokeWeights()

    ///////////////////////////
    // Get Tokens in Pool
    ///////////////////////////
    poolTokens = await poolRouter
    .getPoolTokens();
    console.log(`Final Weights after update` );

    weight1 = await smartPool
    .getDenormalizedWeight(poolTokens[0]);
    console.log(`Token 1 - WBTC '${weight1}' denormalized Weight`)

    weight2 = await smartPool
        .getDenormalizedWeight(poolTokens[1]);
    console.log(`Token 2 - USDC '${weight2}' denormalized Weight`)

    weight3 = await smartPool
        .getDenormalizedWeight(poolTokens[2]);
    console.log(`Token 3 - DAI '${weight3}' denormalized Weight`)

    weight4 = await smartPool
        .getDenormalizedWeight(poolTokens[3]);
    console.log(`Token 4 - WETH  '${weight4}' denormalized Weight`)

    return c;
}