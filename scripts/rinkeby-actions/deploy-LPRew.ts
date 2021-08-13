import {DeployConfig} from "../config-rinkeby";
import {BigNumber, Contract} from "ethers";

import { tenPow18 } from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


import UniswapV2Factory from "../deployment/ContractABIs/UniswapV2Factory.json"
import UniswapV2Router from "../deployment/ContractABIs/UniswapV2Router.json"
import RewardsVault from "../deployment/ContractABIs/RewardsVault.json"
import Staking from "../deployment/ContractABIs/Staking.json"

import {LPRewards, LibRewardsDistribution} from "../../typechain";

export async function Script(c: DeployConfig): Promise<any> {

    let reignTokenAddress = "0x846a65cb79e8f406d0df828ac2bab2c2c4faef62";
    let sovTokenAddress = "0x164a138eefca657a463c5787a3af0c09311b095a";
    let stakingAddress = "0xEF5918a38eC6C02bD47277389d5D4b8382245e54"; 
    let rewardsVaultAddress = "0xe0f2e530045999b41815bda2056de4981c169b2e";
    let usdcAddr = "0xd784369bfd4145fdd8645eaf8a5df3edf5d4a1a2"; 
    let wethAddr = "0x0955468eccd6d2ee06a5e47d0734a7508badf7a5"; 


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
   

    let tx;

    ///////////////////////////
    // Connect to UniswapV2Factory
    ///////////////////////////
    let uniswapFactory = new Contract(
        c.uniswapFactoryAddr, 
        UniswapV2Factory,
        c.sovReignOwnerAcct 
    )
    c.uniswapFactory = uniswapFactory
    console.log(`UniswapV2Factory connected at '${uniswapFactory.address}'`);


    let uniswapRouter = new Contract(
        c.uniswapRouterAddr, 
        UniswapV2Router,
        c.sovReignOwnerAcct 
    )
    c.uniswapRouter = uniswapRouter
    console.log(`UniswapV2Router connected  at '${uniswapRouter.address}'`);

    let lpRewardsAmount =(await tokenDistribution.LP_REWARDS_TOKENS()).div(2);

    /*
    ///////////////////////////
    // Create a pair for REIGN/WETH
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignTokenAddress, wethAddr)
    await tx.wait()
    let reignPairAddress = await  uniswapFactory.getPair(reignTokenAddress, wethAddr )
    console.log(`Deployed a Uniswap pair for REIGN/WETH: '${ reignPairAddress}'`);
    


   ///////////////////////////
    // Deploy "LPRewards" contract for REIGN/USD:
    ///////////////////////////
    const reignLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignTokenAddress, 
            reignPairAddress,
            stakingAddress, 
            rewardsVaultAddress,
            lpRewardsAmount
    ])) as LPRewards;
    console.log(`LPRewards for Uniswap REIGN/WETH LP deployed at: ${reignLpRewards.address}`);
    c.reignLpRewards = reignLpRewards

    console.log("here")
    
    ///////////////////////////
    // Create a pair for SOV/USDC
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(sovTokenAddress, usdcAddr)
    await tx.wait()
*/
    let sovPairAddress = await  uniswapFactory.getPair(sovTokenAddress, usdcAddr )
    console.log(`Deployed a Uniswap pair for SOV/USDC: '${ sovPairAddress}'`);
    
   ///////////////////////////
    // Deploy "LPRewards" contract for SOV/USDC:
    ///////////////////////////
    const sovLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignTokenAddress, 
            sovPairAddress,
            stakingAddress, 
            rewardsVaultAddress,
            lpRewardsAmount
    ])) as LPRewards;
    console.log(`LPRewards for Uniswap SOV/USDC LP deployed at: ${sovLpRewards.address}`);
    c.sovLpRewards = sovLpRewards


     ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsVault = new Contract(
        rewardsVaultAddress,
        RewardsVault,
        c.sovReignOwnerAcct 
    );

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance("0x9C7714292D39b639dD9a1EAd9f45ECA3654d7728",lpRewardsAmount)
    console.log(`Allowance set to : '${"0x9C7714292D39b639dD9a1EAd9f45ECA3654d7728".toLowerCase()}' (reignLpRewards)`);


    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(sovLpRewards.address,lpRewardsAmount)
    console.log(`Allowance set to : '${sovLpRewards.address.toLowerCase()}' (sovLpRewards)`);

    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let staking = new Contract(
        stakingAddress,
        Staking,
        c.sovReignOwnerAcct 
    );

    await staking.connect(c.sovReignOwnerAcct).initEpochForTokens([sovPairAddress, "0x6Dc5c96b9b77e44e7ce31DC2EF7DCb7a78C77252"],0)
    console.log(`Epoch's Initialised in staking`);

    /*
    await reign.connect(c.sovReignOwnerAcct).initialize()
    console.log(`initialize (REIGN)`);

    await sovLpRewards.connect(c.sovReignOwnerAcct).initialize()
    console.log(`initialize (SOV)`);
    */

}