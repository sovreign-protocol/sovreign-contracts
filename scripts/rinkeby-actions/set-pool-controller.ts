import {DeployConfigRinkeby} from "../config-rinkeby";
import {BigNumber, Contract} from "ethers";

import ConfigurableRightsPool from "../deployment/ContractABIs/ConfigurableRightsPool.json"

export async function Script(c: DeployConfigRinkeby): Promise<any> {

    let smartPoolAddress = "0x9E850E0E1cdD1b452A694D27eB82Fa78F502C8C7";
    let reignDAOAddress = "0x78500ee25f607ffc906cccd27077f15f76c01785";
    
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