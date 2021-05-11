import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    BasketBalancer,
    GovRewards,
    PoolController,
    ReignDAO,
    ReignDiamond,
    ReignFacet,
    ReignToken,
    RewardsVault,
    SvrToken
} from "../typechain";
import {diamondAsFacet} from "../test/helpers/diamond";
import {BigNumber} from "ethers";
import * as helpers from "../test/helpers/governance-helpers";
import {day} from "../test/helpers/time";
import {moveAtTimestamp, stakingEpochStart} from "../test/helpers/helpers";

export async function deployAll(c: DeployConfig): Promise<DeployConfig> {

    ///////////////////////////
    // Deploy 'Facet' contracts:
    ///////////////////////////
    const cutFacet = await deploy.deployContract('DiamondCutFacet');
    console.log(`DiamondCutFacet deployed to: ${cutFacet.address.toLowerCase()}`);

    const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
    console.log(`DiamondLoupeFacet deployed to: ${loupeFacet.address.toLowerCase()}`);

    const ownershipFacet = await deploy.deployContract('OwnershipFacet');
    console.log(`OwnershipFacet deployed to: ${ownershipFacet.address.toLowerCase()}`);

    const changeRewardsFacet = await deploy.deployContract('ChangeRewardsFacet');
    console.log(`ChangeRewardsFacet deployed to: ${changeRewardsFacet.address}`);

    const epochClockFacet = await deploy.deployContract('EpochClockFacet');
    console.log(`EpochClockFacet deployed to: ${epochClockFacet.address}`);

    const reignFacet = await deploy.deployContract('ReignFacet');
    console.log(`ReignFacet deployed at: ${reignFacet.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "ReignDiamond" contract:
    ///////////////////////////
    const reignDiamond = await deploy.deployDiamond(
        'ReignDiamond',
        [cutFacet, loupeFacet, ownershipFacet, changeRewardsFacet, reignFacet, epochClockFacet],
        c.sovReignOwnerAddr,
    );
    c.reignDiamond = reignDiamond;
    console.log(`ReignDiamond deployed at: ${reignDiamond.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [c.sovReignOwnerAddr]) as ReignToken;
    c.reignToken = reignToken;
    console.log(`ReignToken deployed at: ${reignToken.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "RewardsVault" contract:
    ///////////////////////////
    const rewardsVault = await deploy.deployContract('RewardsVault', [reignToken.address]) as RewardsVault;
    c.rewardsVault = rewardsVault;
    console.log(`RewardsVault deployed at: ${rewardsVault.address.toLowerCase()}`);

    ///////////////////////////
    // Mint coins "ReignToken" contract:
    ///////////////////////////
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.sovReignOwnerAddr, c.amountReignTokenToSoVReignOwner)
    console.log(`ReignToken minted: '${c.amountReignTokenToSoVReignOwner}' to addr '${c.sovReignOwnerAddr.toLowerCase()}' (SoVReignOwner address)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(rewardsVault.address, c.amountReignTokenToRewardsVault)
    console.log(`ReignToken minted: '${c.amountReignTokenToRewardsVault}' to addr '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user1Addr, c.amountReignTokenToUser1)
    console.log(`ReignToken minted: '${c.amountReignTokenToUser1}' to addr '${c.user1Addr.toLowerCase()}' (User1 address)`);
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user2Addr, c.amountReignTokenToUser2)
    console.log(`ReignToken minted: '${c.amountReignTokenToUser2}' to addr '${c.user2Addr.toLowerCase()}' (User2 address)`);

    ///////////////////////////
    // Deploy "SVR Token" contract:
    ///////////////////////////
    const svrToken = await deploy.deployContract('SvrToken', [c.sovReignOwnerAddr]) as SvrToken;
    c.svrToken = svrToken;
    console.log(`SvrToken deployed at: ${svrToken.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "ReignDAO" contract:
    ///////////////////////////
    const reignDAO = await deploy.deployContract('ReignDAO') as ReignDAO;
    c.reignDAO = reignDAO;
    console.log(`ReignDAO deployed at: ${reignDAO.address.toLowerCase()}`);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////
    const reignDiamondFacet = (await diamondAsFacet(reignDiamond, 'ReignFacet')) as ReignFacet;
    console.log(`Calling initReign() at '${reignDiamondFacet.address.toLowerCase()}' (ReignDiamond contract)`);
    await reignDiamondFacet.connect(c.sovReignOwnerAcct).initReign(reignToken.address, c.epoch1stStartTs, c.epochDuration);

    ///////////////////////////
    // Deploy "GovRewards" contract:
    ///////////////////////////
    const govRewards = (await deploy.deployContract('GovRewards', [reignToken.address, reignDiamond.address, rewardsVault.address])) as GovRewards;
    console.log(`GovRewards deployed at: ${govRewards.address}`);

    ///////////////////////////
    // Set Allowance in "RewardsVault"
    // giving permission to "Rewards" contract:
    ///////////////////////////
    console.log(`Calling setAllowance() at '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(govRewards.address, c.amountReignTokenToRewardsVault)

    ///////////////////////////
    // Init "ReignDAO":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignDAO.address.toLowerCase()}' (ReignDAO contract)`);
    await reignDAO.connect(c.sovReignOwnerAcct).initialize(reignDiamond.address);

    ///////////////////////////
    // Deploy "BasketBalancer" contract:
    ///////////////////////////
    const basketBalancer1 = await deploy.deployContract(
        'BasketBalancer',
        [
            // empty since new pools can be added later (initial state)
            [],
            // empty since new allocations can be added later (initial state)
            [],
            reignDiamond.address,
            reignDAO.address,
            c.sovReignOwnerAcct.address,
            100000000,
            stakingEpochStart
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer1;
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "PoolController" contract:
    ///////////////////////////
    const poolController = await deploy.deployContract(
        'PoolController',
        [
            basketBalancer1.address,
            svrToken.address,
            reignToken.address,
            reignDAO.address,
            // we're using the reignDAO as "treasury"
            reignDAO.address
        ]
    ) as PoolController;
    c.poolController = poolController;
    console.log(`PoolController deployed at: ${poolController.address.toLowerCase()}`);

    ///////////////////////////
    // Set Controller in "SvrToken"
    ///////////////////////////
    // set controller to ReignDiamond:
    await svrToken.connect(c.sovReignOwnerAcct).setController(poolController.address)
    console.log(`SvrToken controller set: '${poolController.address.toLowerCase()}' (PoolController contract)`);

    ///////////////////////////
    // Set Controller in "ReignToken"
    ///////////////////////////
    // set controller to ReignDiamond:
    await reignToken.connect(c.sovReignOwnerAcct).setController(poolController.address)
    console.log(`ReignToken controller set: '${poolController.address.toLowerCase()}' (PoolController contract)`);

    ///////////////////////////
    // Set Controller in "BasketBalancer"
    ///////////////////////////
    // set controller to ReignDiamond:
    await basketBalancer1.connect(c.sovReignOwnerAcct).setController(poolController.address)
    console.log(`BasketBalancer controller set: '${poolController.address.toLowerCase()}' (PoolController contract)`);

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
    await moveAtTimestamp(timeWarpInSeconds)

    return c;
}