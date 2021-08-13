import {DeployConfig} from "../config-rinkeby"
import {BigNumber, Contract} from "ethers";

import RewardsVault from "../deployment-rinkeby/ContractABIs/RewardsVault.json"
import * as deploy from "../../test/helpers/deploy";
import { tenPow18 } from "../../test/helpers/helpers";
import {
    WrappingRewards,
} from "../../typechain";

export async function Script(c: DeployConfig): Promise<any> {

    let rewardsVaultAddress = "0xc8a44079501a6110edf7fe66ff2342f28459cf50";
    let reignToken = "0x64f8b3b0a2a16a2bdfa30568cb769ed5ba760fba";
    let treasoury = "0x4a3e90b0e7ca0ac32588b956d581afd578da3579";
    let wrapper = "0xbfa9ea3b1556687df2e9965ffef84f28911f8a8f";
    let balancer = "0x349884021b0df3d50c07a08edbe171789fd3c8bb";

     //////////////////////////
    // Deploy "WrappingRewards" contract:
    ///////////////////////////
    const wrappingRew = (await deploy.deployContract('WrappingRewards', 
        [reignToken, balancer, wrapper, rewardsVaultAddress, treasoury]
    )) as WrappingRewards;
     console.log(`WrappingRewards deployed at: ${wrappingRew.address}`);

     ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsVault = new Contract(
        rewardsVaultAddress,
        RewardsVault,
        c.sovReignOwnerAcct 
    );

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(wrappingRew.address, BigNumber.from(100000000000000).mul(tenPow18))
    console.log(`Allowance set to : '${wrappingRew.address.toLowerCase()}' (wrappingRewardsAddress)`);


}