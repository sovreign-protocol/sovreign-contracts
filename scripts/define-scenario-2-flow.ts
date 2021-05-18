import {DeployConfig} from "./config";
import {BigNumber, Contract, ContractReceipt, ethers as ejs} from "ethers";
import {PoolRewards, Pool, ReignToken, SvrToken, RewardsVault, UniswapPairOracle, Staking, LiquidityBufferVault, PoolController, LPRewards, GovRewards} from "../typechain";

import {hour, day} from "../test/helpers/time";
import { getCurrentUnix, getLatestBlockTimestamp, mineBlocks, moveAtTimestamp, tenPow18} from "../test/helpers/helpers";
import ERC20 from "./ContractABIs/ERC20.json"

export async function scenario2(c: DeployConfig): Promise<DeployConfig> {

    const reignPrice = BigNumber.from(40000) //0.04 USDC

    const svrToken = c.svrToken as SvrToken;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const liquidityBuffer = c.liquidityBufferVault as LiquidityBufferVault;
    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;
    const uniswapFactory = c.uniswapFactory as Contract;
    const poolController = c.poolController as PoolController;
    const pool1Rewards = c.pool1Rewards as PoolRewards;
    const pool2Rewards = c.pool2Rewards as PoolRewards;
    const wbtc = c.wbtc as Contract;
    const weth = c.weth as Contract;
    const oracle1 = c.oracle1 as UniswapPairOracle;
    const oracle2 = c.oracle2 as UniswapPairOracle;

    let reignPairAddress = await uniswapFactory.getPair(reignToken.address, c.usdcAddr)
    let reignUsdcPair = new Contract(
        reignPairAddress, 
        ERC20,
        c.sovReignOwnerAcct 
    )

    console.log(`\n --- SET UP POOLS ---`);

    let lastEpoch = await staking.getCurrentEpoch()
    console.log(lastEpoch.toString())
    
    for(let i=0;  i < lastEpoch.toNumber(); i++){
        await staking.initEpochForTokens([pool1.address, pool2.address], i)
    }


    await depositMintAndStake(c, "WETH", 5000000)
    await depositMintAndStake(c, "WBTC", 5000000)

    let lastBalance1 = (await reignToken.balanceOf(c.user1Addr))
    let lastBalance2 = (await reignToken.balanceOf(c.user2Addr))


    for(let i=0;  i < 100; i++){

        console.log(`\n --- ROUND ${ i }---`);

        const token = Math.random();
        const action = Math.random();

        if(action > 0.5){
            if(token > 0.5){
                await depositMintAndStake(c, "WETH", 100000)
            }else{
                await depositMintAndStake(c, "WBTC", 100000)
            }
        }else{
            if(token > 0.5){
                await unstakeBurnAndWithdraw(c, "WETH", 100000)
            }else{
                await unstakeBurnAndWithdraw(c, "WBTC", 100000)
            }
        }
        let pool1Target = (await poolController.getTargetSize(pool1.address)).div(10**5);
        let pool2Target = (await poolController.getTargetSize(pool2.address)).div(10**5);
        let pool1Actual = (await pool1.getReserves()).div(10**5);
        let pool2Actual = (await pool2.getReserves()).div(10**5);
        let pool1Diff = (pool1Target.sub(pool1Actual).mul(1000)).div(pool1Target).toNumber() / 1000
        let pool2Diff = (pool2Target.sub(pool2Actual).mul(1000)).div(pool2Target).toNumber() / 1000
        console.log(`Pool1: ${pool1Actual.toString()}/${pool1Target}  - ${pool1Diff * 100}% `)
        console.log(`Pool2: ${pool2Actual.toString()}/${pool2Target}  - ${pool2Diff * 100}% `)


        let epoch = await staking.getCurrentEpoch()

        if (epoch.gt(lastEpoch)){
            pool1Rewards.connect(c.user1Acct).massHarvest()
            pool2Rewards.connect(c.user2Acct).massHarvest()
            let balanceDiff1 = (await reignToken.balanceOf(c.user1Addr)).sub(lastBalance1)
            let balanceDiff2 = (await reignToken.balanceOf(c.user2Addr)).sub(lastBalance2)

            let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
            let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))

            let apy1 = ((balanceDiff1).mul(reignPrice).mul(tenPow18).mul(52)).div(pool1Actual.mul(WETHPrice).div(10**13)).toString()
            let apy2 = ((balanceDiff2).mul(reignPrice).mul(tenPow18).mul(52)).div(pool2Actual.mul(WBTCPrice).div(10**3)).toString()

            console.log(`Epoch: ${epoch.toString()} - Pool1 Rewards: ${balanceDiff1.toString()} REIGN  || ${apy1}% APY `)
            console.log(`Epoch: ${epoch.toString()} - Pool2 Rewards: ${balanceDiff2.toString()} REIGN  || ${apy2}% APY`)

            console.log(`Rewards Left: ${await reignToken.balanceOf(rewardsVault.address)}`)
            console.log(`Liquidity Buffer Left: ${await reignToken.balanceOf(liquidityBuffer.address)}`)

            lastEpoch = epoch
        }

        mineBlocks(400)
        
    }

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
        let depositAmountToken = valueUsdc.div(WETHPrice).mul(tenPow18)
        let depositFee = await pool1.getDepositFeeReign(depositAmountToken)
        await reignToken.connect(c.user1Acct).approve(pool1.address, depositFee);
        console.log(`User1 fee to deposit ${depositFee.toString() } REIGN `)
        await weth.connect(c.user1Acct).approve(pool1.address, depositAmountToken)
        console.log(`User1 deposit ${depositAmountToken.toString() } WETH `)
    
        await pool1.connect(c.user1Acct).mint(c.user1Addr, depositAmountToken)
        let poolLpBalance1 = await pool1.balanceOf(c.user1Addr)
        await pool1.connect(c.user1Acct).approve(staking.address, poolLpBalance1)
        await staking.connect(c.user1Acct).deposit(pool1.address, poolLpBalance1)

    }else{
        let depositAmountToken = valueUsdc.div(WBTCPrice).mul(BigNumber.from(10).pow(await wbtc.decimals()))
        let depositFee = await pool2.getDepositFeeReign(depositAmountToken)
        await reignToken.connect(c.user2Acct).approve(pool2.address, depositFee);
        console.log(`User2 fee to deposit ${depositFee.toString() } REIGN `)
        await wbtc.connect(c.user2Acct).approve(pool2.address, depositAmountToken)
        console.log(`User2 deposit ${depositAmountToken.toString() } WBTC `)
    
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
        let withdrawAmountToken = valueUsdc.div(WETHPrice).mul(tenPow18)
        let withdrawFee = await pool1.getWithdrawFeeReign(withdrawAmountToken)
        await reignToken.connect(c.user1Acct).approve(pool1.address, withdrawFee);
        console.log(`User1 fee to withdraw ${withdrawFee.toString() } REIGN `)

        await staking.connect(c.user1Acct).withdraw(pool1.address, withdrawAmountToken)
        let poolLpBalance1 = await pool1.balanceOf(c.user1Addr)
        await pool1.connect(c.user1Acct).burn(poolLpBalance1)
        console.log(`User1 withdraws ${withdrawAmountToken.toString() } WETH `)

    }else{
        let withdrawAmountToken = valueUsdc.div(WBTCPrice).mul(BigNumber.from(10).pow(await wbtc.decimals()))
        let withdrawFee = await pool2.getWithdrawFeeReign(withdrawAmountToken)
        await reignToken.connect(c.user2Acct).approve(pool2.address, withdrawFee);
        console.log(`User2 fee to withdraw ${withdrawFee.toString() } REIGN `)
        await staking.connect(c.user2Acct).withdraw(pool2.address, withdrawAmountToken)
        let poolLpBalance2 = await pool2.balanceOf(c.user2Addr)
        await pool2.connect(c.user2Acct).burn(poolLpBalance2)
        console.log(`User2 withdraws ${withdrawAmountToken.toString() } WBTC `)
    }
}