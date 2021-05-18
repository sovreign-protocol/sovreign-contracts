import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {PoolRewards, Pool, ReignToken, SvrToken, BasketBalancer, UniswapPairOracle, Staking, LiquidityBufferVault, PoolController, LPRewards, GovRewards} from "../typechain";

import {hour, day} from "../test/helpers/time";
import { getCurrentUnix, getLatestBlockTimestamp, mineBlocks, moveAtTimestamp, tenPow18} from "../test/helpers/helpers";
import ERC20 from "./ContractABIs/ERC20.json"

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    const svrToken = c.svrToken as SvrToken;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const balancer = c.basketBalancer as BasketBalancer;
    const pool1 = c.pool1 as Pool;
    const pool2 = c.pool2 as Pool;
    const uniswapFactory = c.uniswapFactory as Contract;
    const reignLpRewards = c.reignLpRewards as LPRewards;
    const govRewards = c.govRewards as GovRewards;
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


    console.log(`\n --- USERS VOTE ON ALLOCATION ---`);

    ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    let timeWarpInSeconds = day+100
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await moveAtTimestamp(Date.now() + timeWarpInSeconds)

    await oracle1.update()
    await oracle2.update()

    // we should be in staking epoch 2 now
    await staking.initEpochForTokens([pool1.address, pool2.address, reignUsdcPair.address], 0)
    await staking.initEpochForTokens([pool1.address, pool2.address, reignUsdcPair.address], 1)


    await balancer.connect(c.user1Acct).updateBasketBalance()


    ///////////////////////////
    // All Users Vote on Basket Allocation
    ///////////////////////////
    await balancer.connect(c.user1Acct).updateAllocationVote([pool1.address,pool2.address], [510000000,490000000])
    await balancer.connect(c.user2Acct).updateAllocationVote([pool1.address,pool2.address], [510000000,490000000])
    await balancer.connect(c.sovReignOwnerAcct).updateAllocationVote([pool1.address,pool2.address], [510000000,490000000])
    let votePool1 = await balancer.continuousVote(pool1.address)
    console.log(`Continuous Vote Tally Pool1: ${votePool1}`);
    let votePool2 = await balancer.continuousVote(pool2.address)
    console.log(`Continuous Vote Tally Pool2: ${votePool2}`);
    



    console.log(`\n --- USERS STAKE UNISWAP LP ---`);

    let balance = await reignUsdcPair.balanceOf(c.user3Addr)
    await reignUsdcPair.connect(c.user3Acct).approve(staking.address, balance)
    await staking.connect(c.user3Acct).deposit(reignPairAddress, balance)
    console.log(`User3 Staked ${balance} REIGN/USDC LP `);



    console.log(`\n --- USERS DEPOSIT ASSETS INTO POOLS ---`);

    ///////////////////////////
    // Deposit WETH into Pool
    ///////////////////////////
    let depositAmountWeth = BigNumber.from(100).mul(tenPow18) // 100 ETH
    await weth.connect(c.user1Acct).approve(pool1.address, depositAmountWeth)
    console.log(`User1 deposit 100 WETH `)
    

    ///////////////////////////
    // Mint SVR & LP from WETH Pool
    ///////////////////////////
    await pool1.mint(c.user1Addr, depositAmountWeth)
    let svrBalance1 = await svrToken.balanceOf(c.user1Addr)
    console.log(`User1 SVR Balance '${svrBalance1}'`)
    let poolLpBalance1 = await  pool1.balanceOf(c.user1Addr)
    console.log(`User1 Pool1 LP Balance '${poolLpBalance1}'`)

    ///////////////////////////
    // Deposit into WBTC Pool
    ///////////////////////////
    let WETHPrice = await oracle1.consult(c.wethAddr,BigNumber.from(10).pow(await weth.decimals()))
    let WBTCPrice = await oracle2.consult(c.wbtcAddr,BigNumber.from(10).pow(await wbtc.decimals()))
    let depositAmountWbtc = depositAmountWeth.mul(WETHPrice).div(WBTCPrice).div(10**10) // Same value in WBTC
    await wbtc.connect(c.user2Acct).approve(pool2.address, depositAmountWbtc)
    console.log(`User1 deposit '${depositAmountWbtc.toNumber() / 10**8}' WBTC `)


    ///////////////////////////
    // Mint SVR & LP from WBTC Pools
    ///////////////////////////
    await pool2.mint(c.user2Addr, depositAmountWbtc)
    let svrBalance2 = await svrToken.balanceOf(c.user2Addr)
    console.log(`User2 SVR Balance '${svrBalance2}'`)
    let poolLpBalance2 = await pool2.balanceOf(c.user2Addr)
    console.log(`User2 Pool2 LP Balance '${poolLpBalance2}'`)


    ///////////////////////////
    // Burn SVR & LP from WBTC Pools
    ///////////////////////////
    await pool2.connect(c.user2Acct).burn(poolLpBalance2.div(8))
    let svrBalance2After = await svrToken.balanceOf(c.user2Addr)
    console.log(`User2 SVR Balance After Burn '${svrBalance2After}'`)
    let poolLpBalance2After = await pool2.balanceOf(c.user2Addr)
    console.log(`User2 Pool2 LP Balance After Burn '${poolLpBalance2After}'`)

    
    console.log(`\n --- USERS STAKE LP TOKENS ---`)


    ///////////////////////////
    // Deposit Into staking contract
    ///////////////////////////
    await pool1.connect(c.user1Acct).approve(staking.address, poolLpBalance1)
    await staking.connect(c.user1Acct).deposit(pool1.address, poolLpBalance1)
    console.log(`User1 deposits '${poolLpBalance1} into staking'`)

    await pool2.connect(c.user2Acct).approve(staking.address, poolLpBalance2After)
    await staking.connect(c.user2Acct).deposit(pool2.address, poolLpBalance2After)
    console.log(`User2 deposits '${poolLpBalance2After} into staking'`)

    await mineBlocks(8340) // a bit less then 1 day in blocks

    await oracle1.update()
    await oracle2.update()

    ///////////////////////////
    // Interact with pool contracts to accrue interest
    ///////////////////////////
    await staking.connect(c.user1Acct).withdraw(pool1.address, 10)

    let withdrawFee = await pool1.getWithdrawFeeReign(10);
    await reignToken.connect(c.user1Acct).approve(pool1.address, withdrawFee)
    console.log(`User1 pays '${withdrawFee}' REIGN to withdraw 10 WEI`)
    await pool1.connect(c.user1Acct).burn(10)

    await staking.connect(c.user2Acct).withdraw(pool2.address, 10)

    withdrawFee = await pool2.getWithdrawFeeReign(10);
    await reignToken.connect(c.user1Acct).approve(pool2.address, withdrawFee)
    console.log(`User2 pays '${withdrawFee}' REIGN to withdraw 10 Satoshi`)
    await pool2.connect(c.user2Acct).burn(10)

    ///////////////////////////
    // Time warp: go to the next Epoch
    ///////////////////////////
    timeWarpInSeconds = day+100
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await moveAtTimestamp(await getLatestBlockTimestamp() + timeWarpInSeconds)

    await oracle1.update()
    await oracle2.update()


    console.log(`\n --- USERS HARVEST POOL REWARDS ---`);

    ///////////////////////////
    // Harvest from Pool Rewards contracts
    ///////////////////////////
    let reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)
    let reignBalanceBefore2 = await reignToken.balanceOf(c.user2Addr)

    await pool1Rewards.connect(c.user1Acct).massHarvest()
    await pool2Rewards.connect(c.user2Acct).massHarvest()

    let reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    let reignBalanceAfter2 = await reignToken.balanceOf(c.user2Addr)

    console.log(`User1 Pool1 Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)
    console.log(`User2 Pool2 Rewards: '${reignBalanceAfter2.sub(reignBalanceBefore2).div(tenPow18)}' REIGN`)


    console.log(`\n --- USERS HARVEST LP REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user3Addr)

    await reignLpRewards.connect(c.user3Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user3Addr)
    console.log(`User3 REIGN/USDC LP Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)

    console.log(`\n --- USERS HARVEST GOV REWARDS ---`);

    ///////////////////////////
    // Harvest from LP Rewards contracts
    ///////////////////////////
    reignBalanceBefore1 = await reignToken.balanceOf(c.user1Addr)

    await govRewards.connect(c.user1Acct).massHarvest()

    reignBalanceAfter1 = await reignToken.balanceOf(c.user1Addr)
    console.log(`User1 Governance Rewards: '${reignBalanceAfter1.sub(reignBalanceBefore1).div(tenPow18)}' REIGN`)



    return c;
}