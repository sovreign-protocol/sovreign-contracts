import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    BasketBalancer,
    Governance,
    InterestStrategy,
    PoolController, Reign,
    ReignFacet,
    ReignToken,
    Rewards, RewardsVault, SvrToken
} from "../typechain";
import {diamondAsFacet} from "../test/helpers/diamond";
import {BigNumber} from "ethers";

export async function deployAll(c: DeployConfig): Promise<DeployConfig> {

    ///////////////////////////
    // Deploy 'Facet' contracts:
    ///////////////////////////
    const cutFacet = await deploy.deployContract('DiamondCutFacet');
    console.log(`DiamondCutFacet deployed to: ${cutFacet.address}`);

    const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
    console.log(`DiamondLoupeFacet deployed to: ${loupeFacet.address}`);

    const ownershipFacet = await deploy.deployContract('OwnershipFacet');
    console.log(`OwnershipFacet deployed to: ${ownershipFacet.address}`);

    const crf = await deploy.deployContract('ChangeRewardsFacet');
    console.log(`ChangeRewardsFacet deployed to: ${crf.address}`);

    const reignFacet = await deploy.deployContract('ReignFacet');
    console.log(`ReignFacet deployed at: ${reignFacet.address}`);

    ///////////////////////////
    // Deploy "ReignDiamond" contract:
    ///////////////////////////
    const reignDiamond = await deploy.deployDiamond(
        'Reign',
        [cutFacet, loupeFacet, ownershipFacet, crf, reignFacet],
        c.ownerAddr,
    );
    c.reignDiamond = reignDiamond;
    console.log(`Reign deployed at: ${reignDiamond.address}`);

    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [c.ownerAddr]) as ReignToken;
    c.reignToken = reignToken;
    console.log(`ReignToken deployed at: ${reignToken.address}`);

    ///////////////////////////
    // Deploy "RewardsVault" contract:
    ///////////////////////////
    const rewardsVault = await deploy.deployContract('RewardsVault', [reignToken.address]) as RewardsVault;
    c.rewardsVault = rewardsVault;
    console.log(`RewardsVault deployed at: ${rewardsVault.address}`);

    ///////////////////////////
    // Mint coins "ReignToken" contract:
    ///////////////////////////
    await reignToken.connect(c.ownerAcct).mint(rewardsVault.address, c.reignTokenAmountToRewardsVault)
    console.log(`ReignToken minted: '${c.reignTokenAmountToRewardsVault}' to addr '${rewardsVault.address}' (RewardsVault contract)`);

    ///////////////////////////
    // Deploy "SVR Token" contract:
    ///////////////////////////
    const svrToken = await deploy.deployContract('SvrToken', [c.ownerAddr]) as SvrToken;
    c.svrToken = svrToken;
    console.log(`SvrToken deployed at: ${svrToken.address}`);

    ///////////////////////////
    // Deploy "Governance" contract:
    ///////////////////////////
    const reignDAO = await deploy.deployContract('Governance') as Governance;
    c.reignDAO = reignDAO;
    console.log(`Governance deployed at: ${reignDAO.address}`);

    ///////////////////////////
    // Deploy "Rewards" contract:
    ///////////////////////////
    const rewards = (await deploy.deployContract(
        'Rewards', [reignDAO.address, reignToken.address, reignDiamond.address])) as Rewards;
    c.rewards = rewards;
    console.log(`Rewards deployed at: ${rewards.address}`);

    ///////////////////////////
    // Init "Rewards":
    ///////////////////////////
    console.log(`Calling setupPullToken() at '${rewards.address}' (Rewards contract)`);
    await rewards.connect(c.ownerAcct).setupPullToken(rewardsVault.address, c.rewardsStartTs, c.rewardsEndTs, c.rewardsAmount);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////
    console.log(`Calling initReign() at '${rewards.address}' (ReignDiamond contract)`);
    const reign = (await diamondAsFacet(reignDiamond, 'ReignFacet')) as ReignFacet;
    await reign.connect(c.ownerAcct).initReign(reignToken.address, rewards.address);

    ///////////////////////////
    // Init "Governance":
    ///////////////////////////
    console.log(`Calling initialize() at '${reignDAO.address}' (Governance contract)`);
    await reignDAO.connect(c.ownerAcct).initialize(reign.address);

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
            reignDiamond.address
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer1;
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address}`);

    ///////////////////////////
    // Deploy "InterestStrategy" contract:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // both params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            reignDiamond.address
        ]
    ) as InterestStrategy;
    c.interestStrategy = interestStrategy1;
    console.log(`InterestStrategy deployed at: ${interestStrategy1.address}`);

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
    console.log(`PoolController deployed at: ${poolController.address}`);

    ///////////////////////////
    // Set Controller in "SvrToken"
    ///////////////////////////
    // set controller to ReignDiamond:
    await svrToken.connect(c.ownerAcct).setController(poolController.address)
    console.log(`SvrToken controller set: '${poolController.address}' (PoolController contract)`);

    ///////////////////////////
    // Set Controller in "ReignToken"
    ///////////////////////////
    // set controller to ReignDiamond:
    await reignToken.connect(c.ownerAcct).setController(poolController.address)
    console.log(`ReignToken controller set: '${poolController.address}' (PoolController contract)`);

    return c;
}