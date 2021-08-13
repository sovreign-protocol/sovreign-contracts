import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import RewardsVault from "../deployment-rinkeby/ContractABIs/RewardsVault.json"
import * as deploy from "../../test/helpers/deploy";
import { tenPow18 } from "../../test/helpers/helpers";
import {
    GovRewards,
} from "../../typechain";

export async function deployGovRew(c: DeployConfig): Promise<any> {

    let rewardsVaultAddress = "0x86296a7080a4728545c763102c9e015694e6179b";
    let reignToken = "0x08188fc7d8f552d1d8f8d2743404e9e728425ae1";
    let diamond = "0xc31cb4f82f178ea0377492144035c48de119a4f8";
    

     //////////////////////////
    // Deploy "GovRewards" contract:
    ///////////////////////////
    const govRewards = (await deploy.deployContract('GovRewards', [reignToken, diamond, rewardsVaultAddress])) as GovRewards;
    c.govRewards = govRewards
    console.log(`GovRewards deployed at: ${govRewards.address}`);

     ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsVault = new Contract(
        rewardsVaultAddress,
        RewardsVault,
        c.sovReignOwnerAcct 
    );

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(govRewards.address, BigNumber.from(100000000000000).mul(tenPow18))
    console.log(`Allowance set to : '${govRewards.address.toLowerCase()}' (wrappingRewardsAddress)`);


}