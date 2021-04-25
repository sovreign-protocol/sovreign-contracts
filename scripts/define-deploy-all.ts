import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    BasketBalancer,
    Governance,
    InterestStrategy,
    PoolController,
    Reign,
    ReignFacet,
    ReignToken,
    Rewards,
    RewardsVault,
    SvrToken
} from "../typechain";
import {diamondAsFacet} from "../test/helpers/diamond";
import {BigNumber} from "ethers";
import * as helpers from "../test/helpers/governance-helpers";
import {day} from "../test/helpers/time";
import {moveAtTimestamp} from "../test/helpers/helpers";
import {stakingEpochStart}  from "../test/helpers/helpers";

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

    const crf = await deploy.deployContract('ChangeRewardsFacet');
    console.log(`ChangeRewardsFacet deployed to: ${crf.address.toLowerCase()}`);

    const reignFacet = await deploy.deployContract('ReignFacet');
    console.log(`ReignFacet deployed at: ${reignFacet.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "ReignDiamond" contract:
    ///////////////////////////
    const reignDiamond = await deploy.deployDiamond(
        'Reign',
        [cutFacet, loupeFacet, ownershipFacet, crf, reignFacet],
        c.sovReignOwnerAddr,
    );
    c.reignDiamond = reignDiamond;
    console.log(`Reign deployed at: ${reignDiamond.address.toLowerCase()}`);

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
    // Deploy "Governance" contract:
    ///////////////////////////
    const reignDAO = await deploy.deployContract('Governance') as Governance;
    c.reignDAO = reignDAO;
    console.log(`Governance deployed at: ${reignDAO.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "Rewards" contract:
    ///////////////////////////
    const rewards = (await deploy.deployContract(
        'Rewards', [c.sovReignOwnerAddr, reignToken.address, reignDiamond.address])) as Rewards;
    c.rewards = rewards;
    console.log(`Rewards deployed at: ${rewards.address.toLowerCase()}`);

    ///////////////////////////
    // Init "Rewards":
    ///////////////////////////
    console.log(`Calling setupPullToken() at '${rewards.address.toLowerCase()}' (Rewards contract)`);
    await rewards.connect(c.sovReignOwnerAcct).setupPullToken(rewardsVault.address, c.rewardsStartTs, c.rewardsEndTs, c.rewardsAmount);

    ///////////////////////////
    // Set Allowance in "RewardsVault"
    // giving permission to "Rewards" contract:
    ///////////////////////////
    console.log(`Calling setAllowance() at '${rewardsVault.address.toLowerCase()}' (RewardsVault contract)`);
    await rewardsVault.connect(c.sovReignOwnerAcct).setAllowance(rewards.address, c.amountReignTokenToRewardsVault)

    ///////////////////////////
    // Transfer ownership of "Rewards":
    ///////////////////////////
    console.log(`Calling transferOwnership() at '${rewards.address.toLowerCase()}' (Rewards contract) to addr '${reignDAO.address.toLowerCase()}'`);
    await rewards.connect(c.sovReignOwnerAcct).transferOwnership(reignDAO.address.toLowerCase());

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////
    console.log(`Calling initReign() at '${rewards.address.toLowerCase()}' (ReignDiamond contract)`);
    const reignDiamondFacet = (await diamondAsFacet(reignDiamond, 'ReignFacet')) as ReignFacet;
    await reignDiamondFacet.connect(c.sovReignOwnerAcct).initReign(reignToken.address, rewards.address);

    ///////////////////////////
    // Init "Governance":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignDAO.address.toLowerCase()}' (Governance contract)`);
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
            100000,
            stakingEpochStart
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer1;
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "InterestStrategy" contract:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // both params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            reignDiamond.address,
            stakingEpochStart
        ]
    ) as InterestStrategy;
    c.interestStrategy = interestStrategy1;
    console.log(`InterestStrategy deployed at: ${interestStrategy1.address.toLowerCase()}`);

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