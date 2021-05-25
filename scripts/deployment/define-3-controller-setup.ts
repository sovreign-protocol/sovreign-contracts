import {DeployConfig} from "../config";
import * as deploy from "../../test/helpers/deploy";
import {
    BasketBalancer,
    ERC20,
    LiquidityBufferVault,
    PoolController,
    ReignDAO,
    ReignToken,
    SvrToken,
    UniswapPairOracle,
} from "../../typechain";
import {Contract} from "ethers";
import {day} from "../../test/helpers/time";
import {deployOracle} from "../../test/helpers/oracles";
import {increaseBlockTime} from "../../test/helpers/helpers";



export async function controllerSetup(c: DeployConfig): Promise<DeployConfig> {


    console.log(`\n --- SETUP POOL CONTROLLER ---`);

    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const svrToken = c.svrToken as SvrToken;
    const usdc = c.usdc as ERC20;
    const reignToken = c.reignToken as ReignToken;
    //const reignTokenOracle = c.reignTokenOracle as UniswapPairOracle;
    const liquidityBufferVault = c.liquidityBufferVault as LiquidityBufferVault;
    

     ///////////////////////////
    // Deploy an Oracle for the REIGN/USDC Pair
    ///////////////////////////
    let reignTokenOracle = await deployOracle(c, reignToken.address, usdc.address, reignDAO.address)
    c.reignTokenOracle = reignTokenOracle
    console.log(`Deployed Oracle for for REIGN/USDC at: '${reignTokenOracle.address}'`);


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




    return c;
}