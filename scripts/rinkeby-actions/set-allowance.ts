import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import RewardsVault from "../deployment/ContractABIs/RewardsVault.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function setAllowance(c: DeployConfig): Promise<any> {

    let rewardsVaultAddress = "0x6b4bcda40af16ad292f7389c70165c1a8ac23877";
    let wrappingRewardsAddress = "0x20CF7b7F003A32Fa7169ecEeB435ee1af5eE6ED1";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsVault = new Contract(
        rewardsVaultAddress,
        RewardsVault,
        c.sovReignOwnerAcct 
    );

    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(wrappingRewardsAddress, BigNumber.from(100000000000).mul(tenPow18))
    console.log(`Allowance set to : '${wrappingRewardsAddress.toLowerCase()}' (wrappingRewardsAddress)`);

}