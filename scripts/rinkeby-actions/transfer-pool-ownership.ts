import {DeployConfig} from "../config";
import {Contract} from "ethers";

import ConfigurableRightsPool from "../deployment-rinkeby/ContractABIs/ConfigurableRightsPool.json"
import { ethers } from "hardhat";

export async function transferOwnership(c: DeployConfig): Promise<any> {

    let deployedPoolAddress = "0x1bD6Ad914a5b8D60F53D1574b76C83aF18943C88";
    let reignDAOAddress = "0xbce4682c61ab6e2509361d006cf0c07bd982a9b5";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let smartPool = new Contract(
        deployedPoolAddress,
        ConfigurableRightsPool,
        c.sovReignOwnerAcct 
    );

    await smartPool.connect(c.sovReignOwnerAcct).setController(reignDAOAddress)
    console.log(`Smart Pool owner set: '${reignDAOAddress.toLowerCase()}' (Reign DAO)`);

}