import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import {
        WrappingRewards,
        SovWrapper,
        SovToken,
        PoolRouter,
        ReignToken,
        BasketBalancer,
        Staking, 
        LPRewards,
        GovRewards,
    } from "../../typechain";

import {getLatestBlockTimestamp, mineBlocks, moveAtTimestamp, tenPow18, tenPow6, tenPow8} from "../../test/helpers/helpers";
import ERC20 from "../deployment-rinkeby/ContractABIs/ERC20.json"
import { wrap } from "module";

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    const sovWrapper = c.sovWrapper as SovWrapper;
    const wrappingRewards = c.wrappingRewards as WrappingRewards;
    const reignToken = c.reignToken as ReignToken;
    const sovToken = c.sovToken as SovToken;
    const staking = c.staking as Staking;
    const balancer = c.basketBalancer as BasketBalancer;
    const poolRouter = c.poolRouter as PoolRouter;
    const uniswapFactory = c.uniswapFactory as Contract;
    const uniswapRouter = c.uniswapRouter as Contract;
    const reignLpRewards = c.reignLpRewards as LPRewards;
    const sovLpRewards = c.sovLpRewards as LPRewards;
    const govRewards = c.govRewards as GovRewards;
    const sbtc = c.sbtc as Contract;
    const schf = c.schf as Contract;
    const susd = c.susd as Contract;





    console.log(`\n --- USERS DEPOSIT ASSETS INTO POOLS ---`);


    ///////////////////////////
    // Mint SOV by depositing sbtc
    ///////////////////////////
    sbtc.connect(c.sovReignOwnerAcct).transfer(c.user2Addr, 1000000);
    susd.connect(c.sovReignOwnerAcct).transfer(c.user3Addr, 1000000);

    let depositAmountsbtc = 500000 
    await sbtc.connect(c.user2Acct).approve(poolRouter.address, depositAmountsbtc)
    console.log(`User2 approved sbtc`)

    let allowance = await sbtc.allowance(c.user2Addr,poolRouter.address)
    console.log(`User2 allowance '${allowance}'`)
    
    await poolRouter.connect(c.user2Acct).deposit(c.sbtcAddr, depositAmountsbtc, 1, 100000)
    console.log(`User2 deposits sbtc`)
    let sovBalance = await sovToken.balanceOf(c.user2Addr)
    console.log(`User2 SOV Balance '${sovBalance}'`)

    ///////////////////////////
    // Mint SOV by depositing sbtc
    ///////////////////////////
    let depositAmountSusd = 500000
    await susd.connect(c.user3Acct).approve(poolRouter.address, depositAmountSusd)
    console.log(`User3 approved susd`)

     allowance = await susd.allowance(c.user3Addr,poolRouter.address)
    console.log(`User3 allowance '${allowance}'`)
    
    let amountInAll = await poolRouter.getTokensAmountIn(sovBalance, [tenPow18.mul(tenPow8),tenPow18.mul(tenPow8),tenPow18.mul(tenPow8),tenPow18.mul(tenPow8)]);
    console.log(`Needed Amount to mint '${sovBalance}' SOV: '${amountInAll}'`)

    let amountOut = await poolRouter.getSovAmountOutSingle(c.susdAddr, depositAmountSusd, 1);
    console.log(`Expected SOV Out for susd'${amountOut}'`)

    await poolRouter.connect(c.user3Acct).deposit(c.susdAddr, depositAmountSusd, 1, 100000)
    console.log(`User3 deposits susd`)
    let sovBalanceU3 = await sovToken.balanceOf(c.user3Addr)
    console.log(`User3 SOV Balance: '${sovBalanceU3}'`)

    let sovPrice = await poolRouter.getSovAmountInSingle(c.susdAddr, depositAmountSusd, amountOut.mul(2));
    console.log(`SOV needed to withdraw susd: '${sovPrice}' SOV`)

    let amountsOut = await poolRouter.getTokensAmountOut(amountOut, [1,1,1,1]);
    console.log(`'${sovPrice}' SOV can be burned for: '${amountsOut}' `)
    
    console.log(`\n --- USERS HARVEST WRAPPING REWARDS ---`);

    ///////////////////////////
    // Harvest from Wrapping Rewards contracts
    ///////////////////////////
    let reignBalanceBefore1 = await reignToken.balanceOf(c.user2Addr)

    await wrappingRewards.connect(c.user2Acct).massHarvest()

    let reignBalanceAfter1 = await reignToken.balanceOf(c.user2Addr)

    console.log(`User2 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    reignBalanceBefore1 = await reignToken.balanceOf(c.user3Addr)

    await wrappingRewards.connect(c.user3Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user3Addr)

    console.log(`User3 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)



    console.log(`\n --- USERS HARVEST GOV REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)

    await govRewards.connect(c.user1Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    console.log(`User1 Governance Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)



    console.log(`\n --- USERS REDEEM SOV FOR ANOTHER UNDERLYING ---`);

    await poolRouter.connect(c.user3Acct).withdraw(c.sbtcAddr,sovBalanceU3, 1);
    console.log(`User3 Withdraws BTC`)
    sovBalanceU3 = await sovToken.balanceOf(c.user3Addr)
    console.log(`User3 SOV Balance After '${sovBalanceU3}'`)
    let sbtcBalance = await sbtc.balanceOf(c.user3Addr)
    console.log(`User3 sbtc Balance After '${sbtcBalance}'`)


     ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    let timeWarpInSeconds = c.epochDuration+100
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await moveAtTimestamp(await getLatestBlockTimestamp() + timeWarpInSeconds)


    console.log(`\n --- USERS HARVEST WRAPPING REWARDS ---`);

    ///////////////////////////
    // Harvest from Wrapping Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user2Addr)

    await wrappingRewards.connect(c.user2Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user2Addr)

    console.log(`User2 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    reignBalanceBefore1 = await reignToken.balanceOf(c.user3Addr)

    await wrappingRewards.connect(c.user3Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user3Addr)

    console.log(`User3 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)





    return c;
}