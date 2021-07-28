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
import ERC20 from "../deployment/ContractABIs/ERC20.json"
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
    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;
    const usdc = c.usdc as Contract;

    let reignPairAddress = await uniswapFactory.getPair(reignToken.address, c.wethAddr)
    let sovPairAddress = await uniswapFactory.getPair(sovToken.address, c.usdcAddr)

    let reignWethPair = new Contract(
        reignPairAddress, 
        ERC20,
        c.sovReignOwnerAcct 
    )

    let sovUsdcPair = new Contract(
        sovPairAddress, 
        ERC20,
        c.sovReignOwnerAcct 
    )


    console.log(`\n --- START STAKING EPOCHS---`);

    console.log(`Epoch: `, (await sovWrapper.getCurrentEpoch()).toNumber())


    await sovWrapper.initEpoch(0)
    await staking.initEpochForTokens([reignWethPair.address, sovUsdcPair.address], 0)

    await sovWrapper.initEpoch(1)
    await staking.initEpochForTokens([reignWethPair.address, sovUsdcPair.address], 1)

    await sovWrapper.initEpoch(2)
    await staking.initEpochForTokens([reignWethPair.address, sovUsdcPair.address], 2)

    await sovWrapper.initEpoch(3)
    await staking.initEpochForTokens([reignWethPair.address, sovUsdcPair.address], 3)



    console.log(`\n --- USERS STAKE UNISWAP REIGN/WETH LP ---`);

    let balance = await reignWethPair.balanceOf(c.user1Addr)
    await reignWethPair.connect(c.user1Acct).approve(staking.address, balance)
    await staking.connect(c.user1Acct).deposit(reignPairAddress, balance)
    console.log(`User1 Staked ${balance} REIGN/WETH LP `);



    console.log(`\n --- USERS DEPOSIT ASSETS INTO POOLS ---`);


    ///////////////////////////
    // Mint SOV by depositing WBTC
    ///////////////////////////

    let depositAmountWbtc = 50000000 // 0.5 BTC
    await wbtc.connect(c.user2Acct).approve(poolRouter.address, depositAmountWbtc)
    console.log(`User2 approved 0.5 WBTC`)

    let allowance = await wbtc.allowance(c.user2Addr,poolRouter.address)
    console.log(`User2 allowance '${allowance}'`)
    
    await poolRouter.connect(c.user2Acct).deposit(c.wbtcAddr, depositAmountWbtc, 1, 100000)
    console.log(`User2 deposits 0.5 WBTC`)
    let sovBalance = await sovToken.balanceOf(c.user2Addr)
    console.log(`User2 SOV Balance '${sovBalance}'`)

    ///////////////////////////
    // Mint SOV by depositing WBTC
    ///////////////////////////
    let depositAmountUsdc = 20_000_000000 // 20'000 USDC
    await usdc.connect(c.user3Acct).approve(poolRouter.address, depositAmountUsdc)
    console.log(`User3 approved 20'000 USDC`)

     allowance = await usdc.allowance(c.user3Addr,poolRouter.address)
    console.log(`User3 allowance '${allowance}'`)
    
    let amountInAll = await poolRouter.getTokensAmountIn(sovBalance, [tenPow18.mul(tenPow8),tenPow18.mul(tenPow8),tenPow18.mul(tenPow8),tenPow18.mul(tenPow8)]);
    console.log(`Needed Amount to mint '${sovBalance}' SOV: '${amountInAll}'`)

    let amountOut = await poolRouter.getSovAmountOutSingle(c.usdcAddr, depositAmountUsdc, 1);
    console.log(`Expected SOV Out for 20'000 USDC'${amountOut}'`)

    await poolRouter.connect(c.user3Acct).deposit(c.usdcAddr, depositAmountUsdc, 1, 100000)
    console.log(`User3 deposits 20'000 USDC`)
    let sovBalanceU3 = await sovToken.balanceOf(c.user3Addr)
    console.log(`User3 SOV Balance: '${sovBalanceU3}'`)

    let sovPrice = await poolRouter.getSovAmountInSingle(c.usdcAddr, depositAmountUsdc, amountOut.mul(2));
    console.log(`SOV needed to withdraw 20'000 USDC: '${sovPrice}' SOV`)

    let amountsOut = await poolRouter.getTokensAmountOut(amountOut, [1,1,1,1]);
    console.log(`'${sovPrice}' SOV can be burned for: '${amountsOut}' `)
    
    console.log(`\n --- USERS ADD LIQUIDITY TO UNISWAP SOV/USDC LP ---`);

    ///////////////////////////
    // Deposit liquidity into the SOV/USDC pair 
    ///////////////////////////
    let usdcAmount = 10_000_000000
    await usdc.connect(c.user3Acct).transfer(c.user2Addr, usdcAmount);
    let tx = await sovToken.connect(c.user2Acct).approve(uniswapRouter.address, sovBalance)
    await tx.wait();
    tx = await usdc.connect(c.user2Acct).approve(uniswapRouter.address, usdcAmount);
    await tx.wait();
    tx = await uniswapRouter.connect(c.user2Acct).addLiquidity(
        sovToken.address,
            usdc.address,
            sovBalance,
            usdcAmount,
            1,
            1,
            c.user2Addr,
            Date.now() + 1000
        )
    await tx.wait();
    console.log(`Liquidity added to SOV/USDC Pair`);


    console.log(`\n --- USERS STAKE UNISWAP SOV/USDC LP ---`);

    balance = await sovUsdcPair.balanceOf(c.user2Addr)
    await sovUsdcPair.connect(c.user2Acct).approve(staking.address, balance)
    await staking.connect(c.user2Acct).deposit(sovPairAddress, balance)
    console.log(`User2 Staked ${balance} SOV/USDC LP `);
   

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
    let reignBalanceBefore1 = await reignToken.balanceOf(c.user2Addr)

    await wrappingRewards.connect(c.user2Acct).massHarvest()

    let reignBalanceAfter1 = await reignToken.balanceOf(c.user2Addr)

    console.log(`User2 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    reignBalanceBefore1 = await reignToken.balanceOf(c.user3Addr)

    await wrappingRewards.connect(c.user3Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user3Addr)

    console.log(`User3 Wrapping Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    console.log(`\n --- USERS HARVEST LP REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)

    await reignLpRewards.connect(c.user1Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    console.log(`User1 REIGN/WETH LP Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    reignBalanceBefore1 = await reignToken.balanceOf(c.user2Addr)

    await sovLpRewards.connect(c.user2Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user2Addr)
    console.log(`User2 SOV/USDC LP Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    console.log(`\n --- USERS HARVEST GOV REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)

    await govRewards.connect(c.user1Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    console.log(`User1 Governance Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)



    console.log(`\n --- USERS REDEEM SOV FOR ANOTHER UNDERLYING ---`);

    await poolRouter.connect(c.user3Acct).withdraw(c.wbtcAddr,sovBalanceU3, 1);
    console.log(`User3 Withdraws BTC`)
    sovBalanceU3 = await sovToken.balanceOf(c.user3Addr)
    console.log(`User3 SOV Balance After '${sovBalanceU3}'`)
    let wbtcBalance = await wbtc.balanceOf(c.user3Addr)
    console.log(`User3 WBTC Balance After '${wbtcBalance}'`)


     ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    timeWarpInSeconds = c.epochDuration+100
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