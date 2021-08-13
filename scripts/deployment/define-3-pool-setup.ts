import {DeployConfig} from "../config";
import * as deploy from "../../test/helpers/deploy";
import {
    PoolRouter,
    ERC20,
    BasketBalancer,
    SovToken
} from "../../typechain";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {tenPow18,tenPow8} from "../../test/helpers/helpers";

import ConfigurableRightsPool from "./ContractABIs/ConfigurableRightsPool.json"

export async function setupSmartPool(c: DeployConfig): Promise<DeployConfig> {


    console.log(`\n --- SETUP CONFIGURABLE RIGHTS POOL ---`);

    const sbtc = c.sbtc as ERC20;
    const seth = c.seth as ERC20;
    const schf = c.schf as ERC20;
    const susd = c.susd as ERC20;
    const sxau = c.sxau as ERC20;
    const sxag = c.sxag as ERC20;
    const sovToken = c.sovToken as SovToken;
    const smartPoolFactory = c.smartPoolFactory as Contract;
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as Contract;


    const sbtcAmount = BigNumber.from(1).mul(tenPow8);
    const sethAmount = BigNumber.from(15).mul(tenPow8);
    const schfAmount = BigNumber.from(40000).mul(tenPow8);
    const susdAmount = BigNumber.from(45000).mul(tenPow8);
    const sxauAmount = BigNumber.from(30).mul(tenPow8);
    const sxagAmount = BigNumber.from(150).mul(tenPow8);

    

    ///////////////////////////
    // Create Pool
    ///////////////////////////
    const callDatasParams = [
                'SOV-LP',
                'Sovreign Pool LP',
                [
                    sbtc.address, 
                    seth.address,
                    schf.address, 
                    susd.address, 
                    sxau.address, 
                    sxag.address, 
                ],
                [
                    sbtcAmount, 
                    sethAmount,
                    schfAmount, 
                    susdAmount, 
                    sxauAmount, 
                    sxagAmount,  
                ],
                [
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17)),
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(30).mul(BigNumber.from(10).pow(17))
                ],
                5_000000000000000 // 0.5% trading fee
            ]
        

    const callDatasRights =
        [
            true, true, true, true, true, true,
        ]


    let smartPoolAddr = await smartPoolFactory.connect(c.sovReignOwnerAcct).callStatic['newCrp'](
        c.bFactoryAddr,
        callDatasParams,
        callDatasRights
    )
        
    await smartPoolFactory.connect(c.sovReignOwnerAcct).newCrp(
        c.bFactoryAddr,
        callDatasParams,
        callDatasRights
    )


    ///////////////////////////
    // Connect to Pool
    ///////////////////////////
    let smartPool = new Contract(
        smartPoolAddr,
        ConfigurableRightsPool,
        c.sovReignOwnerAcct 
    ) ;
    c.smartPool = smartPool
    console.log(`SmartPool connected at ${smartPoolAddr}`);



    let tx = await sbtc.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, sbtcAmount);
    await tx.wait();
  
    tx = await seth.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, sethAmount);
    await tx.wait();

    tx = await schf.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, schfAmount);
    await tx.wait();

     tx = await susd.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, susdAmount);
    await tx.wait();
  
    tx = await sxau.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, sxauAmount);
    await tx.wait();

    tx = await sxag.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, sxagAmount);
    await tx.wait();


    tx = await smartPool.connect(c.sovReignOwnerAcct).createPool(
        BigNumber.from(10000).mul(tenPow18), // 10'000 tokens
        13292,   // 2 days for weights update
        250  //  ca. 55min token add lock time
    )
    await tx.wait();
    console.log(`Smart Pool Initialized !`);


    let lpSupply = (await smartPool.totalSupply())
    let controller = (await smartPool.getController()).toString()
    console.log(`Initial LP Supply: ${lpSupply.div(tenPow18).toString()}`);
    console.log(`Smart Pool controlled by: ${controller} (sovReignOwnerAcct)`);



    console.log(`\n --- DEPLOY POOL ROUTER ---`);


    ///////////////////////////
    // Deploy Pool Router
    ///////////////////////////
    const poolRouter = await deploy.deployContract('PoolRouter', [
        smartPoolAddr,
        (c.sovWrapper as Contract).address,
        (c.reignDiamond as Contract).address,
        sovToken.address,
        99950
    ]) as PoolRouter;
    c.poolRouter = poolRouter;
    console.log(`PoolRouter deployed at: ${poolRouter.address.toLowerCase()}`);

    ///////////////////////////
    // Whitelist Router as LP
    ///////////////////////////
    tx = await smartPool.connect(c.sovReignOwnerAcct).whitelistLiquidityProvider(poolRouter.address);
    await tx.wait();
    console.log(`PoolRouter Whitelisted`);


    ///////////////////////////
    // Set Pool Cap
    ///////////////////////////
    tx = await smartPool.connect(c.sovReignOwnerAcct).setCap(lpSupply.mul(10000));
    await tx.wait();
    console.log(`Cap Set at ${lpSupply.mul(1000).div(tenPow18).toString()} LP Tokens`);


    console.log(`\n --- DEPLOY BASKET BALANCER ---`);

    ///////////////////////////
    // Deploy "BasketBalancer" contract:
    ///////////////////////////
    const basketBalancer = await deploy.deployContract(
        'BasketBalancer',
        [
            reignDiamond.address,
            reignDAO.address,
            poolRouter.address,
            BigNumber.from(20).mul(BigNumber.from(10).pow(17)), //20% max delta
        ]
    ) as BasketBalancer;
    c.basketBalancer = basketBalancer;
    let tokens = await basketBalancer.getTokens();
    console.log(`BasketBalancer deployed at: ${basketBalancer.address.toLowerCase()}`);
    console.log(`BasketBalancer tracking: ${tokens}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[0])}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[1])}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[2])}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[3])}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[4])}`);
    console.log(`BasketBalancer weighting: ${await basketBalancer.getTargetAllocation(tokens[5])}`);

    return c;
}