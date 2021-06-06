import {DeployConfig} from "../config";
import {Contract} from "ethers";

import CRPFactory from "./ContractABIs/CRPFactory.json"
import UniswapV2Factory from "./ContractABIs/UniswapV2Factory.json"
import UniswapV2Router from "./ContractABIs/UniswapV2Router.json"
import ERC20 from "./ContractABIs/ERC20.json"


export async function contractsPreFlight(c: DeployConfig): Promise<DeployConfig> {
    console.log(`\n --- CONNECTING TO CONTRACTS ---`);

    ///////////////////////////
    // Connect "dai" contract:
    ///////////////////////////
    const dai = new Contract(
        c.daiAddr,
        ERC20,
        c.sovReignOwnerAcct
    )
    c.dai = dai
    console.log(`DAI connected at: ${dai.address.toLowerCase()}`);


     ///////////////////////////
    // Connect "usdc" contract:
    ///////////////////////////
    const usdc = new Contract(
        c.usdcAddr,
        ERC20,
        c.sovReignOwnerAcct
    )
    c.usdc = usdc
    console.log(`USDC connected at: ${usdc.address.toLowerCase()}`);


    ///////////////////////////
    // Connect "wbtc" contract:
    ///////////////////////////
    const wbtc = new Contract(
        c.wbtcAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.wbtc = wbtc
    console.log(`WBTC connected at: ${wbtc.address.toLowerCase()}`);

    ///////////////////////////
    // Connect "usdc" contract:
    ///////////////////////////
    const weth = new Contract(
        c.wethAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.weth = weth
    console.log(`WETH connected at: ${weth.address.toLowerCase()}`);


    ///////////////////////////
    // Connect to Balancer Pool Factory
    ///////////////////////////
    let smartPoolFactory = new Contract(
        c.smartPoolFactoryAddr, 
        CRPFactory,
        c.sovReignOwnerAcct 
    )
    c.smartPoolFactory = smartPoolFactory
    console.log(`SmartPool Factory connected at '${smartPoolFactory.address}'`);

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



    return c;
}