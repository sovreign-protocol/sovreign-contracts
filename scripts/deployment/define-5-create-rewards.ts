import {DeployConfig} from "../config";
import {ethers as ejs, Contract} from "ethers";
import {
    LibRewardsDistribution,
    Staking, 
    ReignDAO,
    ReignToken, 
    RewardsVault,
    SovWrapper,
    WrappingRewards,
    BasketBalancer,
    GovRewards,
    LPRewards, 
    } from "../../typechain";

import {hour, minute} from "../../test/helpers/time";
import {increaseBlockTime} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";


export async function createRewards(c: DeployConfig): Promise<DeployConfig> {


    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const sovWrapper = c.sovWrapper as SovWrapper;
    const basketBalancer = c.basketBalancer as BasketBalancer;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const govRewards = c.govRewards as GovRewards;
    const sovLpRewards = c.sovLpRewards as LPRewards;
    const reignLpRewards = c.reignLpRewards as LPRewards;


    const tokenDistribution = await deploy.deployContract('LibRewardsDistribution' ) as LibRewardsDistribution;
    

    console.log(`\n --- DEPLOY REWARDS ---`);

    ///////////////////////////
    // User1 deploy PoolRewards for Pool1
    ///////////////////////////
    const wrappingRewards = await deploy.deployContract(
        'WrappingRewards',
        [
            reignToken.address,
            basketBalancer.address,
            sovWrapper.address,
            rewardsVault.address,
            reignDiamond.address
        ]
    ) as WrappingRewards;
    c.wrappingRewards = wrappingRewards;
    console.log(`WrappingRewards deployed at: ${wrappingRewards.address.toLowerCase()}`);

  
    ///////////////////////////
    // Set Rewards Allowance
    ///////////////////////////
    let wrappingAmount = await tokenDistribution.WRAPPING_TOKENS();
    rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(
        wrappingRewards.address, wrappingAmount
    );
    console.log(`WrappingRewards allowance set at: ${wrappingAmount}`);

    let govAmount = await tokenDistribution.STAKING_TOKENS();
    rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(
        govRewards.address, govAmount
    );
    console.log(`GovRewards allowance set at: ${govAmount}`);

    /*
    let lpAmount = await tokenDistribution.LP_REWARDS_TOKENS();
    rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(
        sovLpRewards.address, lpAmount.div(2)
    );
    console.log(`LP Sov allowance set at: ${lpAmount.div(2)}`);

    rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(
        reignLpRewards.address, lpAmount.div(2)
    );
    console.log(`LP Reign allowance set at: ${lpAmount.div(2)}`);

    */

    return c;
}