import {DeployConfig} from "../config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {getLatestBlock, increaseBlockTime, mineBlocks, tenPow18} from "../../test/helpers/helpers";
import {hour, minute} from "../../test/helpers/time";
import {
    PoolRouter,
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
    const smartPool = c.smartPool as Contract;
    const poolRouter = c.poolRouter as PoolRouter;
    const dai = c.dai as Contract;



    console.log(`\n --- TRANSFER OWNERSHIP ---`);


    ///////////////////////////
    // Transfer Ownership of Vaults to Diamond
    ///////////////////////////
    await reignToken.connect(c.sovReignOwnerAcct).setOwner(reignDAO.address)
    console.log(`ReignToken owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await rewardsVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Rewards Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await devVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Dev Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address)
    console.log(`Treasury Sale Vault owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    


    ///////////////////////////
    // Transfer Ownership of SmartPool to Diamond
    ///////////////////////////
    await smartPool.connect(c.sovReignOwnerAcct).setController(reignDAO.address)
    console.log(`Smart Pool owner set: '${reignDAO.address.toLowerCase()}' (Reign DAO)`);

    return c;
}