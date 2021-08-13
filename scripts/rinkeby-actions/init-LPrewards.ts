import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import LPRewards from "../deployment-rinkeby/ContractABIs/LPRewards.json"

export async function Script(c: DeployConfig): Promise<any> {

    let LPRewardsSOV = "0x04F47aa96C1F2018E7CD6df7b07b55D1C57cDaf4";
    let LPRewardsREIGN = "0x4cDF326F0cEcF20c1b759C60590839e92e1b4D29";
    
    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let rewardsSov = new Contract(
        LPRewardsSOV,
        LPRewards,
        c.sovReignOwnerAcct 
    );

    let rewardsReign = new Contract(
        LPRewardsREIGN,
        LPRewards,
        c.sovReignOwnerAcct 
    );

    await rewardsSov.connect(c.sovReignOwnerAcct).initialize()
    console.log(`initialize (Sov)`);

    await rewardsReign.connect(c.sovReignOwnerAcct).initialize()
    console.log(`initialize (Reign)`);

}