import {DeployConfig} from "./config";
import {BigNumber, Contract, ContractReceipt, ethers as ejs} from "ethers";
import {PoolRewards, Pool, ReignToken, SvrToken, RewardsVault, UniswapPairOracle, Staking,LibRewardsDistribution, LiquidityBufferVault, PoolController, LPRewards, GovRewards} from "../typechain";

import * as helpers from "../test/helpers/helpers";
import {hour, day} from "../test/helpers/time";
import { getCurrentUnix, getLatestBlockTimestamp, mineBlocks, tenPow8, tenPow18} from "../test/helpers/helpers";
import ERC20 from "./ContractABIs/ERC20.json"

/**
 *  In this Scenario 2 users randomly deposit or withdraw amount in $ into one of the two pools
 *  There are 150 Rounds, initial TVL is 10Mio and REIGN price is 4c
 *  If the deposit fee into a pool is above 8k (8%) the user will not deposit
 *  Base delta is set in config.ts and is -1%
 */

const reignPrice = 40_000 //0.04 USDC
const rounds = 200
const baseRewards = 1_201_923;
const TVL = 40_000_000;
const amount = 100_000
const depositLimit = 0.1;
let depositFeeTotal = BigNumber.from(0);

export async function scenario2(c: DeployConfig): Promise<DeployConfig> {

    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const liquidityBuffer = c.liquidityBufferVault as LiquidityBufferVault;
    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;
    const poolController = c.poolController as PoolController;
    const pool1Rewards = c.pool1Rewards as PoolRewards;
    const pool2Rewards = c.pool2Rewards as PoolRewards;
    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;
    const oracle1 = c.oracle1 as UniswapPairOracle;
    const oracle2 = c.oracle2 as UniswapPairOracle;


    ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    let timeWarpInSeconds = c.epochDuration+100
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await helpers.moveAtTimestamp(await getLatestBlockTimestamp() + timeWarpInSeconds)

    console.log(`\n --- SET UP POOLS ---`);

    let lastEpoch = await staking.getCurrentEpoch()
    let firstEpoch = lastEpoch;

    for(let i=0;  i < lastEpoch.toNumber(); i++){
        await staking.initEpochForTokens([pool1.address, pool2.address], i)
    }


    let apyCounter = 0;
    let rewardsCounter = 0;
    let deltaCounter = 0;


    let rewardsVaultStart = format((await reignToken.balanceOf(rewardsVault.address)).sub(BigNumber.from(14).mul(BigNumber.from(10).pow(25))),18)
    let liquidityBufferStart = format(await reignToken.balanceOf(liquidityBuffer.address),18)

    let lastBalance1 = (await reignToken.balanceOf(c.user1Addr))
    let lastBalance2 = (await reignToken.balanceOf(c.user2Addr))


    await depositMintAndStake(c, "WETH", TVL/2)
    await depositMintAndStake(c, "WBTC", TVL/2)

    //make some rounds of random actions, them mine 3000 blocks
    for(let i = 0;  i < rounds; i++){

        console.log(`\n --- ROUND ${ i }---`);

        const token = Math.random();
        const action = Math.random();

        if(token > 0.5){
            if(action > (0.5 - (await getDelta(c,"WETH"))*2)){
                await depositMintAndStake(c, "WETH", amount)
            }else{
                await unstakeBurnAndWithdraw(c, "WETH", amount)
            }
        }else{
            if(action > (0.5 - (await getDelta(c,"WBTC"))*2)){
                await depositMintAndStake(c, "WBTC", amount)
            }else{
                await unstakeBurnAndWithdraw(c, "WBTC", amount)
            }
        }
        let pool1Target = (await poolController.getTargetSize(pool1.address))
        let pool2Target = (await poolController.getTargetSize(pool2.address))
        let pool1Actual = (await pool1.getReserves())
        let pool2Actual = (await pool2.getReserves())
        let pool1Diff = (pool1Target.sub(pool1Actual).mul(1000)).div(pool1Target).toNumber() / 1000
        let pool2Diff = (pool2Target.sub(pool2Actual).mul(1000)).div(pool2Target).toNumber() / 1000
        console.log(`Pool1: ${format(pool1Actual,18)}/${format(pool1Target,18)}  || ${pool1Diff * 100}% `)
        console.log(`Pool2: ${format(pool2Actual,8)}/${format(pool2Target,8)}  || ${pool2Diff * 100}% `)

        deltaCounter += Math.max(pool1Diff, pool2Diff)

    
        let epoch = await staking.getCurrentEpoch()

        if (epoch.gt(lastEpoch)){
            pool1Rewards.connect(c.user1Acct).massHarvest()
            pool2Rewards.connect(c.user2Acct).massHarvest()
            let balance1 = await reignToken.balanceOf(c.user1Addr)
            let balance2 = await reignToken.balanceOf(c.user2Addr)
            let balanceDiff1 = (balance1).sub(lastBalance1)
            let balanceDiff2 = (balance2).sub(lastBalance2)
            lastBalance1 = balance1
            lastBalance2 = balance2

            let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
            let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))

            let apy1 = computeAPY(pool1Actual, balanceDiff1,WETHPrice,18)
            let apy2 = computeAPY(pool2Actual, balanceDiff2,WBTCPrice,8)

            apyCounter += apy1;
            apyCounter += apy2;
            rewardsCounter += format(balanceDiff1,18);
            rewardsCounter += format(balanceDiff2,18);

            console.log(`Epoch: ${epoch.toString()} - Pool1 Rewards: ${format(balanceDiff1,18)}/${baseRewards} REIGN  || ${apy1}% APY `)
            console.log(`Epoch: ${epoch.toString()} - Pool2 Rewards: ${format(balanceDiff2,18)}/${baseRewards} REIGN  || ${apy2}% APY`)

            console.log(`Rewards Left: ${format((await reignToken.balanceOf(rewardsVault.address)).sub(BigNumber.from(14).mul(BigNumber.from(10).pow(25))),18)}`)
            console.log(`Liquidity Buffer Left: ${format(await reignToken.balanceOf(liquidityBuffer.address),18)}`)

            lastEpoch = epoch
        }

        mineBlocks(60400/(rounds/10)) // ca. 60400 blocks per epoch - get 10 epochs
        
    }


    console.log(`\n --- RESULTS ---`);

    let epochsElapsed = (await staking.getCurrentEpoch()).sub(firstEpoch).toNumber();
    let avgAPY = apyCounter / epochsElapsed
    let avgRewards = rewardsCounter / epochsElapsed
    let baseRewardsTotal =baseRewards * (epochsElapsed-1)

    let rewardsVaultNow = format((await reignToken.balanceOf(rewardsVault.address)).sub(BigNumber.from(14).mul(BigNumber.from(10).pow(25))),18)
    let liquidityBufferNow = format(await reignToken.balanceOf(liquidityBuffer.address),18)
    let rewardsDiff = rewardsVaultNow - rewardsVaultStart
    let liqBufferDiff =  liquidityBufferNow - liquidityBufferStart


    console.log(`Parameters: TVL = 10Mio || REIGN Price = 0.04$ || Base Delta ${c.baseDelta.mul(100).div(tenPow18).toNumber()/100}%`)
    console.log(`Epochs Elapsed: ${epochsElapsed}`)
    console.log(`Average APY across all Pools: ${avgAPY} %`)
    console.log(`Average Delta across Pools: ${deltaCounter/rounds*100} %`)
    console.log(`Average REIGN Distributed per Epoch: ${avgRewards} / ${baseRewards*2} (inflation target)`)
    console.log(`REIGN Distributed Total: ${rewardsCounter}`)
    console.log(`Total Rewards Leaving Vault ${rewardsDiff} vs. target inflation ${baseRewardsTotal*2}`)
    console.log(`Liquidity Buffer Growth ${liqBufferDiff}`)
    console.log(`Deposit Fees paid: ${format(depositFeeTotal,18)} REIGN`)
            
    return c;
}

async function depositMintAndStake(c: DeployConfig, token:string, value:number){

    let valueUsdc = BigNumber.from(value).mul(BigNumber.from(10).pow(6))
    
    const oracle1 = c.oracle1 as UniswapPairOracle;
    const oracle2 = c.oracle2 as UniswapPairOracle;

    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;

    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;

    const reignToken = c.reignToken as ReignToken;


    const staking =c.staking as Staking;

    if(await oracle1.canUpdate()){
        await oracle1.update()
    }
    if(await oracle2.canUpdate()){
        await oracle2.update()
    }

    let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
    let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))

    if (token == "WETH"){
        let depositAmountToken = valueUsdc.mul(tenPow18).div(WETHPrice)
        let depositFee = (await pool1.getDepositFeeReign(depositAmountToken))
        depositFeeTotal = depositFeeTotal.add(depositFee)
        let depositFeeUsd = depositFee.mul(reignPrice).div(10**6)
        let depositFeePerc = format(depositFeeUsd,18) / amount
        if(depositFeePerc > depositLimit){ 
            console.log(`Skip deposit, fee to high: ${depositFeePerc*100}`)   
            await unstakeBurnAndWithdraw(c,"WETH",value)
            return;
        }
        await reignToken.connect(c.user1Acct).approve(pool1.address, await pool1.getDepositFeeReign(depositAmountToken));
        console.log(`User1 fee to deposit ${format(depositFee,18)} USD || ${depositFeePerc*100} %`)
        await weth.connect(c.user1Acct).approve(pool1.address, depositAmountToken)
        console.log(`User1 deposit ${depositAmountToken.div(tenPow18).toString() } WETH `)
    
        await pool1.connect(c.user1Acct).mint(c.user1Addr, depositAmountToken)
        let poolLpBalance1 = await pool1.balanceOf(c.user1Addr)
        await pool1.connect(c.user1Acct).approve(staking.address, poolLpBalance1)
        await staking.connect(c.user1Acct).deposit(pool1.address, poolLpBalance1)

    }else{
        let depositAmountToken = valueUsdc.mul(tenPow8).div(WBTCPrice)
        let depositFee = (await pool2.getDepositFeeReign(depositAmountToken))
        depositFeeTotal = depositFeeTotal.add(depositFee)
        let depositFeeUsd = depositFee.mul(reignPrice).div(10**6)
        let depositFeePerc = format(depositFeeUsd,18) / amount
        if(depositFeePerc > depositLimit){ 
            console.log(`Skip deposit, fee to high: ${depositFeePerc*100}`)
            await unstakeBurnAndWithdraw(c,"WBTC",value)   
            return;
        }
        await reignToken.connect(c.user2Acct).approve(pool2.address, await pool2.getDepositFeeReign(depositAmountToken));
        console.log(`User2 fee to deposit ${format(depositFee,18) } USD || ${depositFeePerc*100} %`)
        await wbtc.connect(c.user2Acct).approve(pool2.address, depositAmountToken)
        console.log(`User2 deposit ${depositAmountToken.div(BigNumber.from(10).pow(await wbtc.decimals())).toString() } WBTC `)
    
        await pool2.connect(c.user2Acct).mint(c.user2Addr, depositAmountToken)
        let poolLpBalance2 = await pool2.balanceOf(c.user2Addr)
        await pool2.connect(c.user2Acct).approve(staking.address, poolLpBalance2)
        await staking.connect(c.user2Acct).deposit(pool2.address, poolLpBalance2)
    }
}

async function unstakeBurnAndWithdraw(c: DeployConfig, token:string, value:number){

    let valueUsdc = BigNumber.from(value).mul(BigNumber.from(10).pow(6))
    
    const oracle1 = c.oracle1 as UniswapPairOracle;
    const oracle2 = c.oracle2 as UniswapPairOracle;

    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;

    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;

    const reignToken = c.reignToken as ReignToken;

    const staking =c.staking as Staking;

    if(await oracle1.canUpdate()){
        await oracle1.update()
    }
    if(await oracle2.canUpdate()){
        await oracle2.update()
    }

    let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
    let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))

    if (token == "WETH"){
        let withdrawAmountToken = valueUsdc.mul(tenPow18).div(WETHPrice)
        let withdrawFee = (await pool1.getWithdrawFeeReign(withdrawAmountToken)).mul(reignPrice).div(10**6)
        let withdrawFeePerc = format(withdrawFee,18) / amount
        await reignToken.connect(c.user1Acct).approve(pool1.address, await pool1.getWithdrawFeeReign(withdrawAmountToken));
        console.log(`User1 fee to withdraw ${format(withdrawFee,18)} USD || ${withdrawFeePerc*100} %`)

        await staking.connect(c.user1Acct).withdraw(pool1.address, withdrawAmountToken)
        let poolLpBalance1 = await pool1.balanceOf(c.user1Addr)
        await pool1.connect(c.user1Acct).burn(poolLpBalance1)
        console.log(`User1 withdraws ${withdrawAmountToken.div(tenPow18).toString() } WETH `)

    }else{
        let withdrawAmountToken = valueUsdc.mul(tenPow8).div(WBTCPrice)
        let withdrawFee = (await pool2.getWithdrawFeeReign(withdrawAmountToken)).mul(reignPrice).div(10**6)
        let withdrawFeePerc = format(withdrawFee,18) / amount
        await reignToken.connect(c.user2Acct).approve(pool2.address, await pool2.getWithdrawFeeReign(withdrawAmountToken));
        console.log(`User2 fee to withdraw ${format(withdrawFee,18)} USD || ${withdrawFeePerc*100} %`)
        await staking.connect(c.user2Acct).withdraw(pool2.address, withdrawAmountToken)
        let poolLpBalance2 = await pool2.balanceOf(c.user2Addr)
        await pool2.connect(c.user2Acct).burn(poolLpBalance2)
        console.log(`User2 withdraws ${withdrawAmountToken.div(BigNumber.from(10).pow(await wbtc.decimals())).toString() } WBTC `)
    }
}


function computeAPY(poolSize:BigNumber, rewards:BigNumber, price:BigNumber, decimals:number){
    let rewardsValue = (rewards).mul(reignPrice).mul(52).div(tenPow18)
    let poolValue = (poolSize).mul(price).div(BigNumber.from(10).pow(decimals))
    return(rewardsValue.mul(10000)).div(poolValue).toNumber() / 100
}

async  function getDelta(c: DeployConfig,token: string){
    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;
    const poolController = c.poolController as PoolController;

    if (token == "WETH"){
        let pool1Target = (await poolController.getTargetSize(pool1.address))
        let pool1Actual = (await pool1.getReserves())
        return (pool1Target.sub(pool1Actual).mul(1000)).div(pool1Target).toNumber() / 1000
    }else{
        let pool2Target = (await poolController.getTargetSize(pool2.address))
        let pool2Actual = (await pool2.getReserves())
        return (pool2Target.sub(pool2Actual).mul(1000)).div(pool2Target).toNumber() / 1000
    }
}


function format(value:BigNumber, decimals:number){
    return value.mul(10000).div(BigNumber.from(10).pow(decimals)).toNumber() / 10000
}