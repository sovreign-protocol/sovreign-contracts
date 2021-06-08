import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import {
        WrappingRewards,
        WrapSVR,
        PoolRouter,
        ReignToken,
        BasketBalancer,
        Staking, 
        LPRewards,
        GovRewards,
    } from "../../typechain";

import {getLatestBlockTimestamp, mineBlocks, moveAtTimestamp, tenPow18} from "../../test/helpers/helpers";
import ERC20 from "../deployment/ContractABIs/ERC20.json"
import { wrap } from "module";

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    const wrapSVR = c.wrapSVR as WrapSVR;
    const wrappingRewards = c.wrappingRewards as WrappingRewards;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const balancer = c.basketBalancer as BasketBalancer;
    const poolRouter = c.poolRouter as PoolRouter;
    const uniswapFactory = c.uniswapFactory as Contract;
    const uniswapRouter = c.uniswapRouter as Contract;
    const reignLpRewards = c.reignLpRewards as LPRewards;
    const svrLpRewards = c.svrLpRewards as LPRewards;
    const govRewards = c.govRewards as GovRewards;
    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;
    const usdc = c.usdc as Contract;

    let reignPairAddress = await uniswapFactory.getPair(reignToken.address, c.wethAddr)
    let svrPairAddress = await uniswapFactory.getPair(wrapSVR.address, c.usdcAddr)

    let reignWethPair = new Contract(
        reignPairAddress, 
        ERC20,
        c.sovReignOwnerAcct 
    )

    let svrUsdcPair = new Contract(
        svrPairAddress, 
        ERC20,
        c.sovReignOwnerAcct 
    )


    console.log(`\n --- START STAKING EPOCHS---`);

    console.log(`Epoch: `, (await wrapSVR.getCurrentEpoch()).toNumber())


    await wrapSVR.initEpochForTokens(0)
    await staking.initEpochForTokens([reignWethPair.address, svrUsdcPair.address], 0)

    await wrapSVR.initEpochForTokens(1)
    await staking.initEpochForTokens([reignWethPair.address, svrUsdcPair.address], 1)

    await wrapSVR.initEpochForTokens(2)
    await staking.initEpochForTokens([reignWethPair.address, svrUsdcPair.address], 2)

    await wrapSVR.initEpochForTokens(3)
    await staking.initEpochForTokens([reignWethPair.address, svrUsdcPair.address], 3)



    console.log(`\n --- USERS STAKE UNISWAP REIGN/WETH LP ---`);

    let balance = await reignWethPair.balanceOf(c.user1Addr)
    await reignWethPair.connect(c.user1Acct).approve(staking.address, balance)
    await staking.connect(c.user1Acct).deposit(reignPairAddress, balance)
    console.log(`User1 Staked ${balance} REIGN/WETH LP `);



    console.log(`\n --- USERS DEPOSIT ASSETS INTO POOLS ---`);


    ///////////////////////////
    // Mint SVR by depositing WBTC
    ///////////////////////////

    let depositAmountWbtc = 50000000 // 0.5 BTC
    await wbtc.connect(c.user2Acct).approve(poolRouter.address, depositAmountWbtc)
    console.log(`User2 approved 0.5 WBTC`)

    let allowance = await wbtc.allowance(c.user2Addr,poolRouter.address)
    console.log(`User2 allowance '${allowance}'`)
    
    await poolRouter.connect(c.user2Acct).deposit(c.wbtcAddr, depositAmountWbtc, 1, 100000)
    console.log(`User2 deposits 0.5 WBTC`)
    let svrBalance = await wrapSVR.balanceOf(c.user2Addr)
    console.log(`User SVR Balance '${svrBalance}'`)

    ///////////////////////////
    // Mint SVR by depositing WBTC
    ///////////////////////////
    let depositAmountUsdc = 20_000_000000 // 20'000 USDC
    await usdc.connect(c.user3Acct).approve(poolRouter.address, depositAmountUsdc)
    console.log(`User3 approved 20'000 USDC`)

     allowance = await usdc.allowance(c.user3Addr,poolRouter.address)
    console.log(`User3 allowance '${allowance}'`)
    
    await poolRouter.connect(c.user3Acct).deposit(c.usdcAddr, depositAmountUsdc, 1, 100000)
    console.log(`User3 deposits 20'000 USDC`)
    let svrBalanceU3 = await wrapSVR.balanceOf(c.user3Addr)
    console.log(`User3 SVR Balance '${svrBalanceU3}'`)

   

    
    console.log(`\n --- USERS ADD LIQUIDITY TO UNISWAP SVR/USDC LP ---`);

    ///////////////////////////
    // Deposit liquidity into the SVR/USDC pair 
    ///////////////////////////
    let usdcAmount = 10_000_000000
    await usdc.connect(c.user3Acct).transfer(c.user2Addr, usdcAmount);
    let tx = await wrapSVR.connect(c.user2Acct).approve(uniswapRouter.address, svrBalance)
    await tx.wait();
    tx = await usdc.connect(c.user2Acct).approve(uniswapRouter.address, usdcAmount);
    await tx.wait();
    tx = await uniswapRouter.connect(c.user2Acct).addLiquidity(
        wrapSVR.address,
            usdc.address,
            svrBalance,
            usdcAmount,
            1,
            1,
            c.user2Addr,
            Date.now() + 1000
        )
    await tx.wait();
    console.log(`Liquidity added to SVR/USDC Pair`);


    console.log(`\n --- USERS STAKE UNISWAP SVR/USDC LP ---`);

    balance = await svrUsdcPair.balanceOf(c.user2Addr)
    await svrUsdcPair.connect(c.user2Acct).approve(staking.address, balance)
    await staking.connect(c.user2Acct).deposit(svrPairAddress, balance)
    console.log(`User2 Staked ${balance} SVR/USDC LP `);
   

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

    await svrLpRewards.connect(c.user2Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user2Addr)
    console.log(`User2 SVR/USDC LP Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)


    console.log(`\n --- USERS HARVEST GOV REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)

    await govRewards.connect(c.user1Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    console.log(`User1 Governance Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)



    console.log(`\n --- USERS REDEEM SVR FOR ANOTHER UNDERLYING ---`);

    await wrapSVR.connect(c.user3Acct).approve(poolRouter.address, svrBalanceU3);
    await poolRouter.connect(c.user3Acct).withdraw(c.wbtcAddr,svrBalanceU3, 1);
    console.log(`User3 Withdraws BTC`)
    svrBalanceU3 = await wrapSVR.balanceOf(c.user3Addr)
    console.log(`User3 SVR Balance After '${svrBalanceU3}'`)
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