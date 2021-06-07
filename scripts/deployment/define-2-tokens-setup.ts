import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import * as deploy from "../../test/helpers/deploy";

import {
    GovRewards, 
    ReignDAO,
    Staking,
    LPRewards,
    ReignToken,
    WrapSVR,
    RewardsVault,
    LibRewardsDistribution,
    BasketBalancer
} from "../../typechain";
import { string } from "hardhat/internal/core/params/argumentTypes";


export async function tokenSetup(c: DeployConfig): Promise<DeployConfig> {

    // this hurts, but, oh well, that's life...
    let tx;

    console.log(`\n --- DEPLOY TOKENS ---`);

    const dai = c.dai as Contract;
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const uniswapFactory = c.uniswapFactory as Contract;


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
   
    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [c.sovReignOwnerAddr]) as ReignToken;
    c.reignToken = reignToken;
    console.log(`ReignToken deployed at: ${reignToken.address.toLowerCase()}`);


    ///////////////////////////
    // Deploy "WrapSVR" contract:
    ///////////////////////////
    const wrapSVR = await deploy.deployContract('WrapSVR') as WrapSVR;
    c.wrapSVR = wrapSVR;
    console.log(`WrapSVR deployed at: ${wrapSVR.address.toLowerCase()}`);



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


    console.log(`\n --- DEPLOY UNISWAP POOLS ---`);


    ///////////////////////////
    // Create a pair for REIGN/WETH
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignToken.address, c.wethAddr)
    await tx.wait()
    let reignPairAddress = await  uniswapFactory.getPair(reignToken.address, c.wethAddr)
    console.log(`Deployed a Uniswap pair for REIGN/WETH: '${ reignPairAddress}'`);


    ///////////////////////////
    // Create a pair for SVR/USDC
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(wrapSVR.address, c.usdcAddr)
    await tx.wait()
    let svrPairAddress = await  uniswapFactory.getPair(wrapSVR.address, c.usdcAddr)
    console.log(`Deployed a Uniswap pair for SVR/USDC: '${ svrPairAddress}'`);
    

    console.log(`\n --- PREPARE REWARDS  ---`);

    ///////////////////////////
    // Deploy "Staking" contract:
    ///////////////////////////
    const staking = (await deploy.deployContract('Staking')) as Staking;
    c.staking = staking
    console.log(`Staking contract deployed at: ${staking.address}`);

    ///////////////////////////
    // Deploy "LPRewards" contract for SVR/dai:
    ///////////////////////////
    const svrLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignToken.address, 
            svrPairAddress, 
            staking.address,  
            rewardsVault.address, 
            lpRewardAllocation.div(2)])) as LPRewards;
    console.log(`LPRewards for Uniswap SVR/dai LP deployed at: ${svrLpRewards.address}`);
    c.svrLpRewards = svrLpRewards

    ///////////////////////////
    // Deploy "LPRewards" contract for REIGN/USD:
    ///////////////////////////
    const reignLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignToken.address, 
            reignPairAddress,
            staking.address, rewardsVault.address,
            lpRewardAllocation.div(2)])) as LPRewards;
    console.log(`LPRewards for Uniswap REIGN/WETH LP deployed at: ${reignLpRewards.address}`);
    c.reignLpRewards = reignLpRewards


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



    console.log(`\n --- DEPLOY BASKET BALANCER ---`);

    ///////////////////////////
    // Deploy "BasketBalancer" contract:
    ///////////////////////////
    const basketBalancer = await deploy.deployContract(
        'BasketBalancer',
        [
            // empty since new pools can be added later (initial state)
            [],
            // empty since new allocations can be added later (initial state)
            [],
            reignDiamond.address,
            reignDAO.address,
            c.sovReignOwnerAddr,
            100000000,
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer;
    console.log(`BasketBalancer deployed at: ${basketBalancer.address.toLowerCase()}`);

    return c;
}