import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";
import {
    GovRewards,
    LPRewards,
    ReignDAO,
    ReignFacet,
    ReignToken,
    Staking
} from "../../typechain";
import * as helpers from "../../test/helpers/governance-helpers";
import {diamondAsFacet} from "../../test/helpers/diamond";
import {getUnixTimestamp} from "../../test/helpers/time";
import {increaseBlockTime} from "../../test/helpers/helpers";


export async function activateSoVReign(c: DeployConfig): Promise<DeployConfig> {
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;
    const svrLpRewards = c.svrLpRewards as LPRewards;
    const reignLpRewards = c.reignLpRewards as LPRewards;
    const govRewards = c.govRewards as GovRewards;


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
    await reignDAO.connect(c.sovReignOwnerAcct).initialize(reignDiamond.address);

    
    ///////////////////////////
    // Init "Staking":
    ///////////////////////////
    console.log(`Calling initialize() at '${staking.address.toLowerCase()}' (Staking contract)`);
    await staking.connect(c.sovReignOwnerAcct).initialize(reignDiamond.address);

    ///////////////////////////
    // Init "svrLPRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${svrLpRewards.address.toLowerCase()}' (SVR LP Rewards contract)`);
    await svrLpRewards.connect(c.sovReignOwnerAcct).initialize();

    ///////////////////////////
    // Init "reignLpRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignLpRewards.address.toLowerCase()}' (REIGN LP Rewards contract)`);
    await reignLpRewards.connect(c.sovReignOwnerAcct).initialize();

    ///////////////////////////
    // Init "reignLpRewards":
    ///////////////////////////
    console.log(`Calling initialize() at '${govRewards.address.toLowerCase()}' (Gov Rewards contract)`);
    await govRewards.connect(c.sovReignOwnerAcct).initialize();

    ///////////////////////////
    // "SoVReignOwner" stakes ReignToken to "ReignDiamond"
    // This is required to "activate" the ReignDAO
    ///////////////////////////
    const amountStakedSoVReignOwner = BigNumber.from(400_000).mul(helpers.tenPow18);

    console.log(`SoVReignOwner approves addr '${reignDiamond.address}' to transfer '${amountStakedSoVReignOwner}'`)
    await reignToken
        .connect(c.sovReignOwnerAcct)
        .approve(reignDiamond.address, amountStakedSoVReignOwner);

    console.log(`SoVReignOwner deposits '${amountStakedSoVReignOwner}' to ReignDiamond`)
    await reignDiamondFacet
        .connect(c.sovReignOwnerAcct)
        .deposit(amountStakedSoVReignOwner);

    ///////////////////////////
    // Activate the "ReignDAO"
    ///////////////////////////
    console.log(`ReignDAO activate()`)
    await reignDAO.connect(c.sovReignOwnerAcct).activate()

    ///////////////////////////
    // Time warp
    ///////////////////////////
    const timeWarpInSeconds = 1 * c.epochDuration
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)

    return c;
}