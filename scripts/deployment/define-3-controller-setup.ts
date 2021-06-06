import {DeployConfig} from "../config";
import * as deploy from "../../test/helpers/deploy";
import {
    BasketBalancer,
    ERC20,
    ReignDAO,
    ReignToken,
    WrapSVR,
    
} from "../../typechain";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {day} from "../../test/helpers/time";
import {increaseBlockTime, tenPow18} from "../../test/helpers/helpers";


import SmartPool from "./ContractABIs/SmartPool.json"

import bFactory from "./ContractABIs/bFactory.json"



export async function controllerSetup(c: DeployConfig): Promise<DeployConfig> {


    console.log(`\n --- SETUP POOL CONTROLLER ---`);

    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const wrapSVR = c.wrapSVR as WrapSVR;
    const weth = c.weth as ERC20;
    const wbtc = c.wbtc as ERC20;
    const usdc = c.usdc as ERC20;
    const reignToken = c.reignToken as ReignToken;
    const smartPoolFactory = c.smartPoolFactory as Contract;

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


    weth.connect(c.user1Acct).transfer(c.sovReignOwnerAddr, BigNumber.from(10).mul(tenPow18))
    wbtc.connect(c.user2Acct).transfer(c.sovReignOwnerAddr, 1000000)
    usdc.connect(c.user3Acct).transfer(c.sovReignOwnerAddr, 10000000)

     ///////////////////////////
    // Connect to Balancer Pool Factory
    ///////////////////////////
    let factory = new Contract(
        c.bFactoryAddr,
        bFactory,
        c.sovReignOwnerAcct 
    )
    
    const callDatasParams = [
                'SVRLP',
                'SoVReign Pool LP',
                [weth.address, wbtc.address, usdc.address],
                [BigNumber.from(10).mul(tenPow18), 1000000, 10000000],
                [10, 10, 10],
                5000000000000000
            ]
        

    const callDatasRights =
        [
            true, false, true, true, true, false,
        ]

    

    

    let smartPoolAdd = await smartPoolFactory.connect(c.sovReignOwnerAcct).callStatic['newCrp'](
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
    // Connect to Balancer Pool Factory
    ///////////////////////////
    let smartPool = new Contract(
        smartPoolAdd,//0x3D7753c4526f8657e383a46dC41eC97414941a80
        SmartPool,
        c.sovReignOwnerAcct 
    ) as ISmartPool;
    c.smartPool = smartPool
    console.log(`SmartPool  connected at '${smartPoolAdd}'`);


    console.log((await smartPool.totalSupply()).toString())
    
    await weth.approve(smartPoolAdd, BigNumber.from(10000).mul(tenPow18));
    await wbtc.approve(smartPoolAdd, BigNumber.from(10000).mul(tenPow18));
    await usdc.approve(smartPoolAdd, BigNumber.from(10000).mul(tenPow18));

    await smartPool.connect(c.sovReignOwnerAcct).createPool(BigNumber.from(100000).mul(tenPow18));

    console.log((await smartPool.totalSupply()).toString())

    
    


    return c;
}