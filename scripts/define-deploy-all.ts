import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    BasketBalancer,
    GovRewards, LiquidityBufferVault,
    PoolController,
    ReignDAO,
    ReignDiamond,
    ReignFacet,
    ReignToken,
    RewardsVault,
    SvrToken,
    ERC20Mock,
} from "../typechain";
import {diamondAsFacet} from "../test/helpers/diamond";
import {BigNumber, Contract} from "ethers";
import * as helpers from "../test/helpers/governance-helpers";
import {day, hour} from "../test/helpers/time";
import {deployOracle} from "../test/helpers/oracles";
import {increaseBlockTime, moveAtTimestamp, stakingEpochStart, contractAt, tenPow18} from "../test/helpers/helpers";
import UniswapV2Factory from "./ContractABIs/UniswapV2Factory.json"
import UniswapV2Router from "./ContractABIs/UniswapV2Router.json"
import ERC20 from "./ContractABIs/ERC20.json"


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
    // Connect "usdc" contract:
    ///////////////////////////
    const usdc = new Contract(
        c.usdcAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.usdc = usdc
    console.log(`USDC connected at: ${usdc.address.toLowerCase()}`);

    ///////////////////////////
    // Connect "wbtc" contract:
    ///////////////////////////
    const wbtc = new Contract(
        c.wbtcAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.wbtc = wbtc
    console.log(`WBTC connected at: ${wbtc.address.toLowerCase()}`);

    ///////////////////////////
    // Connect "usdc" contract:
    ///////////////////////////
    const weth = new Contract(
        c.wethAddr, 
        ERC20,
        c.sovReignOwnerAcct 
    )
    c.weth = weth
    console.log(`WETH connected at: ${weth.address.toLowerCase()}`);

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
    // Deploy "LiquidityBufferVault" contract:
    ///////////////////////////
    const liquidityBufferVault = await deploy.deployContract('LiquidityBufferVault', [reignToken.address]) as LiquidityBufferVault;
    c.liquidityBufferVault = liquidityBufferVault;
    console.log(`LiquidityBufferVault deployed at: ${liquidityBufferVault.address.toLowerCase()}`);

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
    await reignToken.connect(c.sovReignOwnerAcct).mint(c.user3Addr, c.amountReignTokenToUser2)
    console.log(`ReignToken minted: '${c.amountReignTokenToUser2}' to addr '${c.user3Addr.toLowerCase()}' (User3 address)`);

    ///////////////////////////
    // Renounce Ownership in "ReignToken"
    ///////////////////////////
    // set owner to zeroAddress:
    await reignToken.connect(c.sovReignOwnerAcct).setOwner(helpers.ZERO_ADDRESS)
    console.log(`ReignToken owner set: '${helpers.ZERO_ADDRESS.toLowerCase()}' (Zero Address)`);

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
    // giving permission to "GovRewards" contract:
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
            c.sovReignOwnerAddr,
            100000000,
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer1;
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address.toLowerCase()}`);


    ///////////////////////////
    // Connect to UniswapV2Factory
    ///////////////////////////
    let uniswapFactory = new Contract(
        c.uniswapFactoryAddr, 
        UniswapV2Factory,
        c.sovReignOwnerAcct 
    )
    console.log(`Connected to UniswapV2Factory at '${uniswapFactory.address}'`);


    ///////////////////////////
    // Create a pair for REIGN/USDC
    ///////////////////////////
    await uniswapFactory.connect(c.sovReignOwnerAcct).createPair(reignToken.address, usdc.address)
    let pairAddress = await uniswapFactory.getPair(reignToken.address, usdc.address)
    console.log(`Deployed a Uniswap pair for REIGN/USDC: '${pairAddress}'`);

    ///////////////////////////
    // Deposit liquidity into the pair 
    ///////////////////////////
    let uniwapRouter = new Contract(
        c.uniswapRouterAddr, 
        UniswapV2Router,
        c.sovReignOwnerAcct 
    )
    let depositAmountReign = BigNumber.from(1000000).mul(tenPow18)
    let depositAmountUsdc = BigNumber.from(1000000).mul(BigNumber.from(10).pow(6))
    await reignToken.connect(c.user3Acct).approve(uniwapRouter.address, depositAmountReign)
    await usdc.connect(c.user3Acct).approve(uniwapRouter.address, depositAmountUsdc)
    await uniwapRouter.connect(c.user3Acct).addLiquidity(
            reignToken.address,
            usdc.address,
            depositAmountReign,
            depositAmountUsdc,
            1,
            1,
            c.user3Addr,
            Date.now() + 1000
        )

    ///////////////////////////
    //Make a swap to create the price
    ///////////////////////////
    await reignToken.connect(c.user3Acct).approve(uniwapRouter.address, tenPow18)
    await uniwapRouter.connect(c.user3Acct).swapExactTokensForTokens(
        tenPow18,
        1,
        [reignToken.address, usdc.address],
        c.sovReignOwnerAddr,
        Date.now() + 1000
    )

    ///////////////////////////
    // Deploy an Oracle for the Pair
    ///////////////////////////
    let reignTokenOracle = await deployOracle(reignToken.address, usdc.address,
        reignDAO.address)
    console.log(`Deployed Oracle for for REIGN/USDC at: '${reignTokenOracle.address}'`);

    ///////////////////////////
    // Make a swap to update the price
    ///////////////////////////
    await reignToken.connect(c.user3Acct).approve(uniwapRouter.address, tenPow18)
    await uniwapRouter.connect(c.user3Acct).swapExactTokensForTokens(
        tenPow18,
        1,
        [reignToken.address, usdc.address],
        c.sovReignOwnerAddr,
        Date.now() + 1000
    )

    ///////////////////////////
    // Time warp until oracle can be updated
    ///////////////////////////
    const updatePeriod = 1 * hour
    console.log(`Time warping in '${updatePeriod}' seconds...`)
    await increaseBlockTime(updatePeriod)

    ///////////////////////////
    // Update Oracle and get Price
    ///////////////////////////
    await reignTokenOracle.update();
    let firstPrice = await reignTokenOracle.consult(reignToken.address,tenPow18);
    console.log(`First Price for REIGN/USDC: '${firstPrice}'`);

    ///////////////////////////
    // Deploy "PoolController" contract:
    ///////////////////////////
    const poolController = await deploy.deployContract(
        'PoolController',
        [
            basketBalancer1.address,
            svrToken.address,
            reignToken.address,
            reignTokenOracle.address,
            reignDAO.address,
            reignDiamond.address,
            liquidityBufferVault.address
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
    // Set Controller in "BasketBalancer"
    ///////////////////////////
    // set controller to poolController:
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
    await increaseBlockTime(timeWarpInSeconds)

    return c;
}