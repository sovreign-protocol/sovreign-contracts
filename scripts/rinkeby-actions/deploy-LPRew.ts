import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import { tenPow18 } from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


import UniswapV2Factory from "../deployment/ContractABIs/UniswapV2Factory.json"
import UniswapV2Router from "../deployment/ContractABIs/UniswapV2Router.json"

import {LPRewards} from "../../typechain";

export async function Script(c: DeployConfig): Promise<any> {

    let reignTokenAddress = "0x64f8b3b0a2a16a2bdfa30568cb769ed5ba760fba";
    let stakingAddress = "0x5Faf8C61A65670C9472E6ef909195a76104c6356"; 
    let rewardsVaultAddress = "0xc8a44079501a6110edf7fe66ff2342f28459cf50";
    let sbtcAddre = "0xf65c93902ecc4c7979e92ed2cca01421e8021f77"; 

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

    ///////////////////////////
    // Create a pair for REIGN/WETH
    ///////////////////////////
    tx = await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignTokenAddress, sbtcAddre)
    await tx.wait()
    let reignPairAddress = await  uniswapFactory.getPair(reignTokenAddress, sbtcAddre )
    console.log(`Deployed a Uniswap pair for REIGN/WETH: '${ reignPairAddress}'`);
    
   ///////////////////////////
    // Deploy "LPRewards" contract for REIGN/USD:
    ///////////////////////////
    const reignLpRewards = (await deploy.deployContract('LPRewards', 
        [
            reignTokenAddress, 
            reignPairAddress,
            stakingAddress, rewardsVaultAddress,
            BigNumber.from(100000000000).mul(tenPow18)])) as LPRewards;
    console.log(`LPRewards for Uniswap REIGN/WETH LP deployed at: ${reignLpRewards.address}`);
    c.reignLpRewards = reignLpRewards

}