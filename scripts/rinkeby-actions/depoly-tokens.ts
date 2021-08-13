import {DeployConfig} from "../config-rinkeby";
import {BigNumber, Contract} from "ethers";

import {ERC20Mock} from "../../typechain";
import * as deploy from "../../test/helpers/deploy";


export async function Script(c: DeployConfig): Promise<any> {
  //////////////////////////
    // Deploy "ERC20Mock" contract:
    ///////////////////////////
    const sbtc = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;
     console.log(`sbtc deployed at: ${sbtc.address}`);


}