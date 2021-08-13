import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import {
    BasketBalancer,
    GovRewards,
    LPRewards,
    PoolRouter,
    ReignDAO,
    ReignFacet,
    ReignToken,
    Staking,
    SovWrapper
} from "../../typechain";
import * as helpers from "../../test/helpers/governance-helpers";
import {diamondAsFacet} from "../../test/helpers/diamond";
import {getUnixTimestamp} from "../../test/helpers/time";


export async function activateSoVReign(c: DeployConfig): Promise<DeployConfig> {
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const sovWrapper = c.sovWrapper as SovWrapper;
    const poolRouter = c.poolRouter as PoolRouter;
    //const sovLpRewards = c.sovLpRewards as LPRewards;
    // reignLpRewards = c.reignLpRewards as LPRewards;
    const govRewards = c.govRewards as GovRewards;
    const basketBalancer = c.basketBalancer as BasketBalancer;
    const smartPool = c.smartPool as Contract;


    console.log(`\n --- ACTIVATE CONTRACTS ---`);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////
    const reignDiamondFacet = (await diamondAsFacet(reignDiamond, 'ReignFacet')) as ReignFacet;
    console.log(`Calling initReign() at '${reignDiamondFacet.address.toLowerCase()}' (ReignDiamond contract)`);
    await reignDiamondFacet.connect(c.sovReignOwnerAcct).initReign(reignToken.address, getUnixTimestamp(), c.epochDuration);

    ///////////////////////////
    // Init "ReignDAO":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignDAO.address.toLowerCase()}' (ReignDAO contract)`);
    await reignDAO.connect(c.sovReignOwnerAcct).initialize(
        reignDiamond.address, 
        basketBalancer.address,
        smartPool.address
    );

    
    ///////////////////////////
    // Init "Staking":
    ///////////////////////////
    console.log(`Calling initialize() at '${staking.address.toLowerCase()}' (Staking contract)`);
    await staking.connect(c.sovReignOwnerAcct).initialize(
        reignDiamond.address
        );

    ///////////////////////////
    // Init "SovWrapper":
    ///////////////////////////
    console.log(`Calling initialize() at '${sovWrapper.address.toLowerCase()}' (SovWrapper contract)`);
    await sovWrapper.connect(c.sovReignOwnerAcct).initialize(
        reignDiamond.address,
        reignDAO.address,
        smartPool.address,
        poolRouter.address
        );

    /*
    ///////////////////////////
    // Init "sovLPRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${sovLpRewards.address.toLowerCase()}' (SOV LP Rewards contract)`);
    await sovLpRewards.connect(c.sovReignOwnerAcct).initialize();

    ///////////////////////////
    // Init "reignLpRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignLpRewards.address.toLowerCase()}' (REIGN LP Rewards contract)`);
    await reignLpRewards.connect(c.sovReignOwnerAcct).initialize();
*/
    ///////////////////////////
    // Init "reignLpRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${govRewards.address.toLowerCase()}' (Gov Rewards contract)`);
    await govRewards.connect(c.sovReignOwnerAcct).initialize();

    


    return c;
}