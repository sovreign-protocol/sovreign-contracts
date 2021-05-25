import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import {hour} from "../../test/helpers/time";
import {deployOracle} from "../../test/helpers/oracles";
import {increaseBlockTime, tenPow18, tenPow6, waitFor} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";

import {
    GovRewards, 
    LiquidityBufferVault,
    ReignDAO,
    Staking,
    LPRewards,
    ReignToken,
    UniswapPairOracle,
    SvrToken,
    RewardsVault,
    LibRewardsDistribution,
} from "../../typechain";


export async function uniswapSetup(c: DeployConfig): Promise<DeployConfig> {

    // this hurts, but, oh well, that's life...
    let tx;

    const usdc = c.usdc as Contract;
    const reignDiamond = c.reignDiamond as Contract;
    const reignDAO = c.reignDAO as ReignDAO;
    const uniswapFactory = c.uniswapFactory as Contract;
    const uniswapRouter = c.uniswapRouter as Contract;
    const svrToken = c.svrToken as SvrToken;
    const reignToken = c.reignToken as ReignToken;
    const reignTokenOracle = c.reignTokenOracle as UniswapPairOracle;


    console.log(`\n --- PREPARE UNISWAP POOLS ---`);

    


    ///////////////////////////
    // Deposit liquidity into the REIGN/USDC pair 
    ///////////////////////////
    let depositAmountReign = BigNumber.from(10000).mul(tenPow18)
    let depositAmountUsdc = BigNumber.from(10000).mul(tenPow6)
    tx = await reignToken.connect(c.user3Acct).approve(uniswapRouter.address, depositAmountReign)
    await tx.wait();
    tx = await usdc.connect(c.user3Acct).approve(uniswapRouter.address, depositAmountUsdc);
    await tx.wait();
    tx = await uniswapRouter.connect(c.user3Acct).addLiquidity(
            reignToken.address,
            usdc.address,
            depositAmountReign,
            depositAmountUsdc,
            1,
            1,
            c.user3Addr,
            Date.now() + 1000
        )
    await tx.wait();
    console.log(`Liquidity added to REIGN Pair`);


    /*
    ///////////////////////////
    // Make a swap to create the REIGN/USDC price
    ///////////////////////////
    tx = await reignToken.connect(c.user3Acct).approve(uniswapRouter.address, tenPow18)
    await tx.wait();
    tx = await uniswapRouter.connect(c.user3Acct).swapExactTokensForTokens(
        tenPow18,
        1,
        [reignToken.address, usdc.address],
        c.sovReignOwnerAddr,
        Date.now() + 1000
    )
    await tx.wait();
    console.log(`Made a swap in Pool`);



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
    */


    return c;
}