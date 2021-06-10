import {DeployConfig} from "../config";
import * as deploy from "../../test/helpers/deploy";
import {
    PoolRouter,
    ERC20,
    BasketBalancer,
    SovToken
} from "../../typechain";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {tenPow18} from "../../test/helpers/helpers";

import ConfigurableRightsPool from "./ContractABIs/ConfigurableRightsPool.json"

export async function setupSmartPool(c: DeployConfig): Promise<DeployConfig> {


    console.log(`\n --- SETUP CONFIGURABLE RIGHTS POOL ---`);

    const dai = c.dai as ERC20;
    const wbtc = c.wbtc as ERC20;
    const usdc = c.usdc as ERC20;
    const sovToken = c.sovToken as SovToken;
    const smartPoolFactory = c.smartPoolFactory as Contract;
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as Contract;


    ///////////////////////////
    // Transfer Tokens Necessary to Owner
    ///////////////////////////
    let wbtcAmount = 1000000000    // ~ 330'000 $
    let usdcAmount = 330000000000 // ~ 330'000 $
    let daiAmount = BigNumber.from(330000).mul(tenPow18)// ~ 330'000 $
    await wbtc.connect(c.user2Acct).transfer(c.sovReignOwnerAddr, wbtcAmount*2) 
    await usdc.connect(c.user3Acct).transfer(c.sovReignOwnerAddr, usdcAmount*2) 
    await dai.connect(c.user4Acct).transfer(c.sovReignOwnerAddr, daiAmount.mul(2))  



    ///////////////////////////
    // Create Pool
    ///////////////////////////
    const callDatasParams = [
                'SOVLP',
                'SoVReign Pool LP',
                [
                    wbtc.address, 
                    usdc.address,
                    dai.address, 
                ],
                [
                    wbtcAmount, 
                    usdcAmount,
                    daiAmount, 
                ],
                [
                    BigNumber.from(130).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(130).mul(BigNumber.from(10).pow(17)), 
                    BigNumber.from(130).mul(BigNumber.from(10).pow(17))
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



    
    await dai.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, daiAmount);
    await wbtc.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, wbtcAmount);
    await usdc.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, usdcAmount);


    await smartPool.connect(c.sovReignOwnerAcct).createPool(
        BigNumber.from(10000).mul(tenPow18),
        13292,   // 2 days for weights update
        250  //  ca. 55min token add lock time
    )


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
    smartPool.connect(c.sovReignOwnerAcct).whitelistLiquidityProvider(poolRouter.address);
    console.log(`PoolRouter Whitelisted`);


    ///////////////////////////
    // Set Pool Cap
    ///////////////////////////
    smartPool.connect(c.sovReignOwnerAcct).setCap(lpSupply.mul(10000));
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
    console.log(`BasketBalancer tracking at: ${tokens}`);
    console.log(`BasketBalancer weighting at: ${await basketBalancer.getTargetAllocation(tokens[0])}`);
    console.log(`BasketBalancer weighting at: ${await basketBalancer.getTargetAllocation(tokens[1])}`);
    console.log(`BasketBalancer weighting at: ${await basketBalancer.getTargetAllocation(tokens[2])}`);

    return c;
}