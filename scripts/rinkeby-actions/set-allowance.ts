import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import RewardsVault from "../deployment/ContractABIs/RewardsVault.json"
import { ethers } from "hardhat";
import { tenPow18 } from "../../test/helpers/helpers";

export async function setAllowance(c: DeployConfig): Promise<any> {

    let rewardsVaultAddress = "0x86296a7080a4728545c763102c9e015694e6179b";
    let wrappingRewardsAddress = "0xb2410885d946f95c70b411fcdbe866dd7b287907";
    
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