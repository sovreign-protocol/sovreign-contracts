import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import PoolRouter from "../deployment/ContractABIs/PoolRouter.json"
import erc20 from "../deployment/ContractABIs/ERC20.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function approveDeposit(c: DeployConfig): Promise<any> {

    let routerAddress = "0x89e0da559126aa5ca804d4c7c30715522031b92b";
    let sBTCAddress = "0x3a85973fd194c9fb966882fee7b11481c38344fb";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let router = new Contract(
        routerAddress,
        PoolRouter,
        c.sovReignOwnerAcct 
    );

    let sbtc = new Contract(
        sBTCAddress,
        erc20,
        c.sovReignOwnerAcct 
    );

    await sbtc.connect(c.user2Acct).approve(routerAddress, BigNumber.from(100000000000000).mul(tenPow18))
    console.log(`Allowance set to : '${routerAddress.toLowerCase()}' (router)`);

    console.log(`Balance of : '${(await sbtc.balanceOf(c.user2Addr))}' (router)`);


    await router.connect(c.user2Acct).deposit(sBTCAddress, BigNumber.from(10).mul(tenPow18), 1, 10000)
    console.log(`Deposited set to : '${routerAddress.toLowerCase()}' (router)`);

}