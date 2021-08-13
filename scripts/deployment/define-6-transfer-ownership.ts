import {DeployConfig} from "../config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {getLatestBlock, increaseBlockTime, mineBlocks, tenPow18} from "../../test/helpers/helpers";
import {hour, minute} from "../../test/helpers/time";
import {
    PoolRouter,
    ReignDAO,
    ReignToken,
    SovToken,
    RewardsVault,
} from "../../typechain";


export async function transferOwnership(c: DeployConfig): Promise<DeployConfig> {


    const reignDAO = c.reignDAO as ReignDAO;
    const sovToken = c.sovToken as SovToken;
    const reignToken = c.reignToken as ReignToken;
    const rewardsVault = c.rewardsVault as RewardsVault;
    const devVault = c.devVault as RewardsVault;
    const treasurySaleVault = c.treasurySaleVault as RewardsVault;
    const smartPool = c.smartPool as Contract;
    const poolRouter = c.poolRouter as PoolRouter;

    const ultimateOwner = c.sovReignOwnerAddr;



    console.log(`\n --- SET SOV MINTER ---`);

    ///////////////////////////
    // Make PoolRouter a Minter
    ///////////////////////////
    await sovToken.connect(c.sovReignOwnerAcct).setMinter(poolRouter.address, true)
    console.log(`SovToken minter set: '${poolRouter.address.toLowerCase()}' (Pool Router)`);


    console.log(`\n --- TRANSFER OWNERSHIP ---`);


    ///////////////////////////
    // Transfer Ownership of Vaults to Diamond
    ///////////////////////////
    await reignToken.connect(c.sovReignOwnerAcct).setOwner(ultimateOwner)
    console.log(`ReignToken owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);

    await sovToken.connect(c.sovReignOwnerAcct).setReignDAO(ultimateOwner)
    console.log(`SovToken owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);
    
    await rewardsVault.connect(c.sovReignOwnerAcct).transferOwnership(ultimateOwner)
    console.log(`Rewards Vault owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);

    await devVault.connect(c.sovReignOwnerAcct).transferOwnership(ultimateOwner)
    console.log(`Dev Vault owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);

    await treasurySaleVault.connect(c.sovReignOwnerAcct).transferOwnership(ultimateOwner)
    console.log(`Treasury Sale Vault owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);


    await smartPool.connect(c.sovReignOwnerAcct).setController(reignDAO.address)
    console.log(`Smart Pool Controller set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);

    


    ///////////////////////////
    // Transfer Ownership of SmartPool to Diamond
    ///////////////////////////
    await smartPool.connect(c.sovReignOwnerAcct).setController(ultimateOwner)
    console.log(`Smart Pool owner set: '${ultimateOwner.toLowerCase()}' (Reign DAO)`);

    return c;
}