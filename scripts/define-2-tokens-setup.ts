import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    GovRewards, 
    LiquidityBufferVault,
    ReignDAO,
    Staking,
    LPRewards,
    ReignToken,
    SvrToken,
    RewardsVault,
    LibRewardsDistribution,
} from "../typechain";
import {BigNumber, Contract} from "ethers";
import * as helpers from "../test/helpers/governance-helpers";
import {hour} from "../test/helpers/time";
import {deployOracle} from "../test/helpers/oracles";
import {increaseBlockTime,  tenPow18} from "../test/helpers/helpers";


export async function tokenSetup(c: DeployConfig): Promise<DeployConfig> {
    console.log(`\n --- DEPLOY TOKENS ---`);
    

    const usdc = c.usdc as Contract;
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const uniswapFactory = c.uniswapFactory as Contract;
    const uniswapRouter = c.uniswapRouter as Contract;

    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
   

    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [c.sovReignOwnerAddr]) as ReignToken;
    c.reignToken = reignToken;
    console.log(`ReignToken deployed at: ${reignToken.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "SVR Token" contract:
    ///////////////////////////
    const svrToken = await deploy.deployContract('SvrToken', [c.sovReignOwnerAddr]) as SvrToken;
    c.svrToken = svrToken;
    console.log(`SvrToken deployed at: ${svrToken.address.toLowerCase()}`);


    console.log(`\n --- DEPLOY VAULTS ---`);

    ///////////////////////////
    // Deploy "RewardsVault" contract:
    ///////////////////////////
    const rewardsVault = await deploy.deployContract('RewardsVault', [reignToken.address]) as RewardsVault;
    c.rewardsVault = rewardsVault;
    console.log(`RewardsVault deployed at: ${rewardsVault.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "Development Vault" contract:
    ///////////////////////////
    const devVault = await deploy.deployContract('RewardsVault', [reignToken.address]) as RewardsVault;
    c.devVault = devVault;
    console.log(`Development Vault deployed at: ${devVault.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "Treasury Sale Vault" contract:
    ///////////////////////////
    const treasurySaleVault = await deploy.deployContract('RewardsVault', [reignToken.address]) as RewardsVault;
    c.treasurySaleVault = treasurySaleVault;
    console.log(`Treasury Sale Vault deployed at: ${treasurySaleVault.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "LiquidityBufferVault" contract:
    ///////////////////////////
    const liquidityBufferVault = await deploy.deployContract('LiquidityBufferVault', [reignToken.address]) as LiquidityBufferVault;
    c.liquidityBufferVault = liquidityBufferVault;
    console.log(`LiquidityBufferVault deployed at: ${liquidityBufferVault.address.toLowerCase()}`);


    console.log(`\n --- DISTRIBUTE REIGN ---`);


    ///////////////////////////
    // Distribute "ReignToken":
    ///////////////////////////
    const teamAllocation = await tokenDistribution.TEAM()
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.sovReignOwnerAddr,teamAllocation.div(2))
    console.log(`ReignToken minted: '${teamAllocation.div(2).toString()}' to addr '${c.sovReignOwnerAddr.toLowerCase()}' (SoVReignOwner address)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user1Addr, teamAllocation.div(6))
    console.log(`ReignToken minted: '${teamAllocation.div(6).toString()}' to addr '${c.user1Addr.toLowerCase()}' (User1 address)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user2Addr, teamAllocation.div(6))
    console.log(`ReignToken minted: '${teamAllocation.div(6).toString()}' to addr '${c.user2Addr.toLowerCase()}' (User2 address)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user3Addr, teamAllocation.div(6))
    console.log(`ReignToken minted: '${teamAllocation.div(6).toString()}' to addr '${c.user3Addr.toLowerCase()}' (User3 address)`);
   
    // Rewards Vault
    const poolRewardAllocation = await tokenDistribution.POOL_TOKENS()
    await reignToken.connect(c.sovReignOwnerAcct).mint(rewardsVault.address, poolRewardAllocation)
    console.log(`ReignToken minted: '${poolRewardAllocation.toString()}' to addr '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    
    // Rewards Vault
    const lpRewardAllocation = await tokenDistribution.LP_REWARDS_TOKENS()
    await reignToken.connect(c.sovReignOwnerAcct).mint(rewardsVault.address, lpRewardAllocation)
    console.log(`ReignToken minted: '${lpRewardAllocation.toString()}' to addr '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    
    // Rewards Vault
    const govRewardsAllocation = await tokenDistribution.STAKING_TOKENS()
    await reignToken.connect(c.sovReignOwnerAcct).mint(rewardsVault.address, govRewardsAllocation)
    console.log(`ReignToken minted: '${govRewardsAllocation.toString()}' to addr '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    
    // Dev Vault
    const devAllocation = await tokenDistribution.DEV_FUND()
    await reignToken.connect(c.sovReignOwnerAcct).mint(devVault.address, devAllocation)
    console.log(`ReignToken minted: '${devAllocation.toString()}' to addr '${devVault.address.toLowerCase()}' (DevFund contract)`);
    
    // Treasury
    const treasuryAllocation = await tokenDistribution.TREASURY()
    await reignToken.connect(c.sovReignOwnerAcct).mint(reignDiamond.address, treasuryAllocation)
    console.log(`ReignToken minted: '${treasuryAllocation.toString()}' to addr '${reignDiamond.address.toLowerCase()}' (ReignDiamond contract)`);
    
    // Treasury Sale
    const treasurySaleAllocation = await tokenDistribution.TREASURY_SALE()
    await reignToken.connect(c.sovReignOwnerAcct).mint(treasurySaleVault.address, treasurySaleAllocation)
    console.log(`ReignToken minted: '${treasurySaleAllocation.toString()}' to addr '${treasurySaleVault.address.toLowerCase()}' (TreasurySale contract)`);

    // Liquidity Buffer 
    const liquidityBufferAllocation = await tokenDistribution.LIQUIDITY_BUFFER()
    await reignToken.connect(c.sovReignOwnerAcct).mint(liquidityBufferVault.address, liquidityBufferAllocation)
    console.log(`ReignToken minted: '${liquidityBufferAllocation.toString()}' to addr '${liquidityBufferVault.address.toLowerCase()}' (LiquidityBuffer contract)`);
    


    console.log(`\n --- PREPARE UNISWAP POOLS ---`);

    ///////////////////////////
    // Create a pair for SVR/USDC
    ///////////////////////////
    await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(svrToken.address, usdc.address)
    let svrPairAddress = await uniswapFactory.getPair(svrToken.address, usdc.address)
    console.log(`Deployed a Uniswap pair for SVR/USDC: '${svrPairAddress}'`);

    ///////////////////////////
    // Create a pair for REIGN/USDC
    ///////////////////////////
    await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignToken.address, usdc.address)
    let reignPairAddress = await uniswapFactory.getPair(reignToken.address, usdc.address)
    console.log(`Deployed a Uniswap pair for REIGN/USDC: '${reignPairAddress}'`);

    ///////////////////////////
    // Deposit liquidity into the REIGN/USDC pair 
    ///////////////////////////
    let depositAmountReign = BigNumber.from(1000000).mul(tenPow18)
    let depositAmountUsdc = BigNumber.from(1000000).mul(BigNumber.from(10).pow(6))
    await reignToken.connect(c.user3Acct).approve(uniswapRouter.address, depositAmountReign)
    await usdc.connect(c.user3Acct).approve(uniswapRouter.address, depositAmountUsdc)
    await uniswapRouter.connect(c.user3Acct).addLiquidity(
            reignToken.address,
            usdc.address,
            depositAmountReign,
            depositAmountUsdc,
            1,
            1,
            c.user3Addr,
            Date.now() + 1000
        )

    ///////////////////////////
    //Make a swap to create the REIGN/USDC price
    ///////////////////////////
    await reignToken.connect(c.user3Acct).approve(uniswapRouter.address, tenPow18)
    await uniswapRouter.connect(c.user3Acct).swapExactTokensForTokens(
        tenPow18,
        1,
        [reignToken.address, usdc.address],
        c.sovReignOwnerAddr,
        Date.now() + 1000
    )

    ///////////////////////////
    // Deploy an Oracle for the REIGN/USDC Pair
    ///////////////////////////
    let reignTokenOracle = await deployOracle(reignToken.address, usdc.address,
        reignDAO.address)
    c.reignTokenOracle = reignTokenOracle
    console.log(`Deployed Oracle for for REIGN/USDC at: '${reignTokenOracle.address}'`);

    ///////////////////////////
    // Make a swap to update the REIGN/USDC price
    ///////////////////////////
    await reignToken.connect(c.user3Acct).approve(uniswapRouter.address, tenPow18)
    await uniswapRouter.connect(c.user3Acct).swapExactTokensForTokens(
        tenPow18,
        1,
        [reignToken.address, usdc.address],
        c.sovReignOwnerAddr,
        Date.now() + 1000
    )

    ///////////////////////////
    // Time warp until oracle can be updated
    ///////////////////////////
    const updatePeriod = 1 * hour
    console.log(`Time warping in '${updatePeriod}' seconds...`)
    await increaseBlockTime(updatePeriod)

    ///////////////////////////
    // Update Oracle and get Price
    ///////////////////////////
    await reignTokenOracle.update();
    let firstPrice = await reignTokenOracle.consult(reignToken.address,tenPow18);
    console.log(`First Price for REIGN/USDC: '${firstPrice}'`);


    console.log(`\n --- PREPARE REWARDS  ---`);

    ///////////////////////////
    // Deploy "Staking" contract:
    ///////////////////////////
    const staking = (await deploy.deployContract('Staking')) as Staking;
    c.staking = staking
    console.log(`Staking contract deployed at: ${staking.address}`);

    ///////////////////////////
    // Deploy "LPRewards" contract for SVR/USDC:
    ///////////////////////////
    const svrLpRewards = (await deploy.deployContract('LPRewards', [reignToken.address, svrPairAddress, staking.address,  rewardsVault.address, 500])) as LPRewards;
    console.log(`LPRewards for Uniswap SVR/USDC LP deployed at: ${svrLpRewards.address}`);
    c.lpRewards = svrLpRewards

    ///////////////////////////
    // Deploy "LPRewards" contract for REIGN/USDC:
    ///////////////////////////
    const reignLpRewards = (await deploy.deployContract('LPRewards', [reignToken.address, reignPairAddress, staking.address,  rewardsVault.address, 500])) as LPRewards;
    console.log(`LPRewards for Uniswap REIGN/USDC LP deployed at: ${reignLpRewards.address}`);
    c.lpRewards = reignLpRewards


    //////////////////////////
    // Deploy "GovRewards" contract:
    ///////////////////////////
    const govRewards = (await deploy.deployContract('GovRewards', [reignToken.address, reignDiamond.address, rewardsVault.address])) as GovRewards;
    c.govRewards = govRewards
    console.log(`GovRewards deployed at: ${govRewards.address}`);


    console.log(`\n --- SET ALLOWANCES ---`);

    ///////////////////////////
    // Set Allowance for Vaults
    ///////////////////////////
    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(govRewards.address, govRewardsAllocation)
    console.log(`Calling setAllowance() from (RewardsVault contract) to (GovRewards contract)`);

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(svrLpRewards.address, lpRewardAllocation.div(2))
    console.log(`Calling setAllowance() from (RewardsVault contract) to (SVR/USD LPRewards contract)`);

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(reignLpRewards.address, lpRewardAllocation.div(2))
    console.log(`Calling setAllowance() from (RewardsVault contract) to (REIGN/USD LPRewards contract)`);

    await devVault.connect(c.sovReignOwnerAcct).setAllowance(reignDAO.address, devAllocation)
    console.log(`Calling setAllowance() from (DevVault contract) to (Reign DAO contract)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).setAllowance(reignDAO.address, treasurySaleAllocation)
    console.log(`Calling setAllowance() from (TreasurySaleVault contract) to (Reign DAO contract)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).setAllowance(reignDAO.address, treasurySaleAllocation)
    console.log(`Calling setAllowance() from (TreasurySaleVault contract) to (Reign DAO contract)`);



    console.log(`\n --- TRANSFER OWNERSHIP ---`);


    ///////////////////////////
    // Renounce Ownership in "ReignToken"
    ///////////////////////////
    // set owner to zeroAddress:
    await reignToken.connect(c.sovReignOwnerAcct).setOwner(helpers.ZERO_ADDRESS)
    console.log(`ReignToken owner set: '${helpers.ZERO_ADDRESS.toLowerCase()}' (Zero Address)`);

    ///////////////////////////
    // Transfer Ownership from Vaults to Diamond
    ///////////////////////////
    await rewardsVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Rewards Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await devVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Dev Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Treasury Sale Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await liquidityBufferVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Liquidity Buffer Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    return c;
}