import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import * as deploy from "../../test/helpers/deploy";

import {
    GovRewards, 
    ReignDAO,
    Staking,
    LPRewards,
    ReignToken,
    SovToken,
    SovWrapper,
    RewardsVault,
    LibRewardsDistribution,
    VestingRouter
} from "../../typechain";
import { zeroAddress } from "../../test/helpers/helpers";


export async function tokenSetup(c: DeployConfig): Promise<DeployConfig> {

    // this hurts, but, oh well, that's life...
    let tx;

    console.log(`\n --- DEPLOY TOKENS ---`);

    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
   
    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [c.sovReignOwnerAddr,]) as ReignToken;
    c.reignToken = reignToken;
    console.log(`ReignToken deployed at: ${reignToken.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "SovToken" contract:
    ///////////////////////////
    const sovToken = await deploy.deployContract('SovToken', [c.sovReignOwnerAddr, zeroAddress]) as SovToken;
    c.sovToken = sovToken;
    console.log(`SovToken deployed at: ${sovToken.address.toLowerCase()}`);




    console.log(`\n --- DEPLOY WRAPPER CONTRACT ---`);

    ///////////////////////////
    // Deploy "SovWrapper" contract:
    ///////////////////////////
    const sovWrapper = await deploy.deployContract('SovWrapper') as SovWrapper;
    c.sovWrapper = sovWrapper;
    console.log(`SovWrapper deployed at: ${sovWrapper.address.toLowerCase()}`);



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


    const teamAllocation = await tokenDistribution.TEAM()


    ///////////////////////////
    // Deploy "Vesting Router" contract:
    ///////////////////////////
    const vestingRouter = await deploy.deployContract('VestingRouter', [
        [
            c.sovReignOwnerAddr, 
            c.user1Addr,
            c.user2Addr, 
            c.user3Addr
        ],[
            teamAllocation.div(2), 
            teamAllocation.div(6), 
            teamAllocation.div(6), 
            teamAllocation.div(6)
        ],
        reignToken.address]
    ) as RewardsVault;
    console.log(`Vesting Router deployed at: ${vestingRouter.address.toLowerCase()}`);


    console.log(`\n --- DISTRIBUTE REIGN ---`);


    ///////////////////////////
    // Distribute "ReignToken":
    ///////////////////////////
    await reignToken.connect(c.sovReignOwnerAcct).mint(vestingRouter.address,teamAllocation)
    console.log(`ReignToken minted: '${teamAllocation}' to addr '${vestingRouter.address.toLowerCase()}' (Vesting Router address)`);

    // Rewards Vault
    const poolRewardAllocation = await tokenDistribution.WRAPPING_TOKENS()
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


    ///////////////////////////
    // Deploy "Staking" contract:
    ///////////////////////////
    const staking = (await deploy.deployContract('Staking')) as Staking;
    c.staking = staking
    console.log(`Staking contract deployed at: ${staking.address}`);


    
    /*
    console.log(`\n --- DEPLOY UNISWAP POOLS ---`);


    ///////////////////////////
    // Create a pair for REIGN/WETH
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignToken.address, c.wethAddr)
    await tx.wait()
    let reignPairAddress = await  uniswapFactory.getPair(reignToken.address, c.wethAddr)
    console.log(`Deployed a Uniswap pair for REIGN/WETH: '${ reignPairAddress}'`);


    ///////////////////////////
    // Create a pair for SOV/USDC
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(sovToken.address, c.usdcAddr)
    await tx.wait()
    let sovPairAddress = await  uniswapFactory.getPair(sovToken.address, c.usdcAddr)
    console.log(`Deployed a Uniswap pair for SOV/USDC: '${ sovPairAddress}'`);
    

    console.log(`\n --- PREPARE REWARDS  ---`);

    
    ///////////////////////////
    // Deploy "LPRewards" contract for sov/usdc:
    ///////////////////////////
    const sovLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignToken.address, 
            sovPairAddress, 
            staking.address,  
            rewardsVault.address, 
            lpRewardAllocation.div(2)])) as LPRewards;
    console.log(`LPRewards for Uniswap SOV/USDC LP deployed at: ${sovLpRewards.address}`);
    c.sovLpRewards = sovLpRewards

    ///////////////////////////
    // Deploy "LPRewards" contract for REIGN/WETH:
    ///////////////////////////
    const reignLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignToken.address, 
            reignPairAddress,
            staking.address, rewardsVault.address,
            lpRewardAllocation.div(2)])) as LPRewards;
    console.log(`LPRewards for Uniswap REIGN/WETH LP deployed at: ${reignLpRewards.address}`);
    c.reignLpRewards = reignLpRewards

    */


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
/*
    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(sovLpRewards.address, lpRewardAllocation.div(2))
    console.log(`Calling setAllowance() from (RewardsVault contract) to (SOV/USDC LPRewards contract)`);

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(reignLpRewards.address, lpRewardAllocation.div(2))
    console.log(`Calling setAllowance() from (RewardsVault contract) to (REIGN/WETH LPRewards contract)`);
*/
    await devVault.connect(c.sovReignOwnerAcct).setAllowance(reignDAO.address, devAllocation)
    console.log(`Calling setAllowance() from (DevVault contract) to (Reign DAO contract)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).setAllowance(reignDAO.address, treasurySaleAllocation)
    console.log(`Calling setAllowance() from (TreasurySaleVault contract) to (Reign DAO contract)`);


    return c;
}