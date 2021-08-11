import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import ConfigurableRightsPool from "../deployment/ContractABIs/ConfigurableRightsPool.json"
import erc20 from "../deployment/ContractABIs/ERC20.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function Script(c: DeployConfig): Promise<any> {

    let smartPoolAddress = "0x81afEb02084F6E98dE8f0D945968578cF6Aa58fD";
    let reignDAOAddress = "0x81284c9f26338d6067f15d58c9d30af1d145627d";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let pool = new Contract(
        smartPoolAddress,
        ConfigurableRightsPool,
        c.sovReignOwnerAcct 
    );

   

    await pool.connect(c.sovReignOwnerAcct).setController(reignDAOAddress)
    console.log(`Controller set to : '${reignDAOAddress.toLowerCase()}' (ReignDAO)`);

}