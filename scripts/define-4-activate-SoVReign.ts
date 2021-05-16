import {DeployConfig} from "./config";
import {
    ReignDAO,
    ReignFacet,
    ReignToken,
    Staking,
} from "../typechain";
import {diamondAsFacet} from "../test/helpers/diamond";
import {getUnixTimestamp} from "../test/helpers/time";
import {BigNumber, Contract} from "ethers";
import * as helpers from "../test/helpers/governance-helpers";
import {day, hour} from "../test/helpers/time";
import {increaseBlockTime} from "../test/helpers/helpers";


export async function activateSoVReign(c: DeployConfig): Promise<DeployConfig> {
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const reignToken = c.reignToken as ReignToken;
    const staking = c.staking as Staking;


    console.log(`\n --- ACTIVATE CONTRACTS ---`);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////
    const reignDiamondFacet = (await diamondAsFacet(reignDiamond, 'ReignFacet')) as ReignFacet;
    console.log(`Calling initReign() at '${reignDiamondFacet.address.toLowerCase()}' (ReignDiamond contract)`);
    await reignDiamondFacet.connect(c.sovReignOwnerAcct).initReign(reignToken.address, getUnixTimestamp()*1000, c.epochDuration);

    ///////////////////////////
    // Init "ReignDAO":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignDAO.address.toLowerCase()}' (ReignDAO contract)`);
    await reignDAO.connect(c.sovReignOwnerAcct).initialize(reignDiamond.address);

    

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
    const timeWarpInSeconds = 1 * day
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await increaseBlockTime(timeWarpInSeconds)

    return c;
}