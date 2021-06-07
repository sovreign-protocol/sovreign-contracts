import {DeployConfig} from "../config";
import * as deploy from "../../test/helpers/deploy";
import {
    PoolRouter,
    ERC20,
} from "../../typechain";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {tenPow18} from "../../test/helpers/helpers";

import ConfigurableRightsPool from "./ContractABIs/ConfigurableRightsPool.json"

export async function setupSmartPool(c: DeployConfig): Promise<DeployConfig> {


    console.log(`\n --- SETUP CONFIGURABLE RIGHTS POOL ---`);

    const weth = c.weth as ERC20;
    const wbtc = c.wbtc as ERC20;
    const usdc = c.usdc as ERC20;
    const smartPoolFactory = c.smartPoolFactory as Contract;


    ///////////////////////////
    // Transfer Tokens Necessary to Owner
    ///////////////////////////
    weth.connect(c.user1Acct).transfer(c.sovReignOwnerAddr, BigNumber.from(10).mul(tenPow18))
    wbtc.connect(c.user2Acct).transfer(c.sovReignOwnerAddr, 2_00000000)
    usdc.connect(c.user3Acct).transfer(c.sovReignOwnerAddr, 20000_000000)



    ///////////////////////////
    // Create Pool
    ///////////////////////////
    const callDatasParams = [
                'SVRLP',
                'SoVReign Pool LP',
                [weth.address, wbtc.address, usdc.address],
                [BigNumber.from(10).mul(tenPow18), 1_00000000, 10000_000000],
                [BigNumber.from(26).mul(tenPow18), BigNumber.from(4).mul(tenPow18), BigNumber.from(10).mul(tenPow18)],
                5000000000000000
            ]
        

    const callDatasRights =
        [
            true, false, true, true, true, true,
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

    
    await weth.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, BigNumber.from(10).mul(tenPow18));
    await wbtc.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, 10_00000000);
    await usdc.connect(c.sovReignOwnerAcct).approve(smartPoolAddr, 10000_000000);


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
        (c.wrapSVR as Contract).address,
        (c.reignDiamond as Contract).address,
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

    return c;
}