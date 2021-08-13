import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import RewardsVault from "../deployment-rinkeby/ContractABIs/RewardsVault.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function Script(c: DeployConfig): Promise<any> {

    let rewardsVaultAddress = "0xc8a44079501a6110edf7fe66ff2342f28459cf50";
    let wrappingRewardsAddress = "0x855dD13AbAb0e891952Fd973634cefBb1c5AAbAC";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsVault = new Contract(
        rewardsVaultAddress,
        RewardsVault,
        c.sovReignOwnerAcct 
    );

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(wrappingRewardsAddress, BigNumber.from(100000000000000).mul(tenPow18))
    console.log(`Allowance set to : '${wrappingRewardsAddress.toLowerCase()}' (wrappingRewardsAddress)`);

}