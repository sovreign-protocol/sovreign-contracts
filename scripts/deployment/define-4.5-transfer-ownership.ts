import {DeployConfig} from "../config";

import {
    ReignDAO,
    ReignToken,
    RewardsVault,
} from "../../typechain";


export async function transferOwnership(c: DeployConfig): Promise<DeployConfig> {


    const reignDAO = c.reignDAO as ReignDAO;
    const reignToken = c.reignToken as ReignToken;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const devVault = c.devVault as RewardsVault;
    const treasurySaleVault = c.treasurySaleVault as RewardsVault;



    console.log(`\n --- TRANSFER OWNERSHIP ---`);


    ///////////////////////////
    // Transfer Ownership from Vaults to Diamond
    ///////////////////////////
    await reignToken.connect(c.sovReignOwnerAcct).setOwner(reignDAO.address)
    console.log(`ReignToken owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await rewardsVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Rewards Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await devVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Dev Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Treasury Sale Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);



    return c;
}