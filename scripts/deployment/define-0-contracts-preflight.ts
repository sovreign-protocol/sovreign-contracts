import {DeployConfig} from "../config";
import {Contract} from "ethers";

import CRPFactory from "./ContractABIs/CRPFactory.json"
import UniswapV2Factory from "./ContractABIs/UniswapV2Factory.json"
import UniswapV2Router from "./ContractABIs/UniswapV2Router.json"
import ERC20 from "./ContractABIs/ERC20.json"


export async function contractsPreFlight(c: DeployConfig): Promise<DeployConfig> {
    console.log(`\n --- CONNECTING TO CONTRACTS ---`);

    ///////////////////////////
    // Connect "susd" contract:
    ///////////////////////////
    const susd = new Contract(
        c.susdAddr,
        ERC20,
        c.sovReignOwnerAcct
    )
    c.susd = susd
    console.log(`sUSD connected at: ${susd.address.toLowerCase()}`);


     ///////////////////////////
    // Connect "schf" contract:
    ///////////////////////////
    const schf = new Contract(
        c.schfAddr,
        ERC20,
        c.sovReignOwnerAcct
    )
    c.schf = schf
    console.log(`schf connected at: ${schf.address.toLowerCase()}`);


    ///////////////////////////
    // Connect "sbtc" contract:
    ///////////////////////////
    const sbtc = new Contract(
        c.sbtcAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.sbtc = sbtc
    console.log(`sbtc connected at: ${sbtc.address.toLowerCase()}`);

    ///////////////////////////
    // Connect "seth" contract:
    ///////////////////////////
    const seth = new Contract(
        c.sethAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.seth = seth
    console.log(`seth connected at: ${seth.address.toLowerCase()}`);


     ///////////////////////////
    // Connect "sxau" contract:
    ///////////////////////////
    const sxau = new Contract(
        c.sxauAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.sxau = sxau
    console.log(`sxau connected at: ${sxau.address.toLowerCase()}`);

     ///////////////////////////
    // Connect "sxag" contract:
    ///////////////////////////
    const sxag = new Contract(
        c.sxagAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.sxag = sxag
    console.log(`sxag connected at: ${sxag.address.toLowerCase()}`);

    
    ///////////////////////////
    // Connect "weth" contract:
    ///////////////////////////
    const weth = new Contract(
        c.wethAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.weth = weth
    console.log(`weth connected at: ${weth.address.toLowerCase()}`);


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