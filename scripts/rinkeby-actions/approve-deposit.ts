import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import PoolRouter from "../deployment-rinkeby/ContractABIs/PoolRouter.json"
import erc20 from "../deployment-rinkeby/ContractABIs/ERC20.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function Script(c: DeployConfig): Promise<any> {

    let routerAddress = "0xdd87fcefe89c598d835b412009f2f4f9209753cd";
    let sBTCAddress = "0xf65C93902eCC4c7979E92ED2cca01421e8021F77";
    
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

    await sbtc.connect(c.sovReignOwnerAcct).approve(routerAddress, BigNumber.from(100000000000000).mul(tenPow18))
    console.log(`Allowance set to : '${routerAddress.toLowerCase()}' (router)`);

    console.log(`Balance of : '${(await sbtc.balanceOf(c.user2Addr))}' (router)`);


    await router.connect(c.sovReignOwnerAcct).deposit(sBTCAddress, BigNumber.from(10).mul(tenPow18), 1, 10000)
    console.log(`Deposited set to : '${routerAddress.toLowerCase()}' (router)`);

}