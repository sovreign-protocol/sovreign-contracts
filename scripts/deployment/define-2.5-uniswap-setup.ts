import {DeployConfig} from "../config";
import {BigNumber, Contract} from "ethers";

import {hour} from "../../test/helpers/time";
import {increaseBlockTime, tenPow18, tenPow6, waitFor} from "../../test/helpers/helpers";
import * as deploy from "../../test/helpers/deploy";

import {
    ReignToken,
} from "../../typechain";


export async function uniswapSetup(c: DeployConfig): Promise<DeployConfig> {

    // this hurts, but, oh well, that's life...
    let tx;

    const usdc = c.usdc as Contract;
    const weth = c.weth as Contract;
    const uniswapRouter = c.uniswapRouter as Contract;
    const reignToken = c.reignToken as ReignToken;


    console.log(`\n --- PREPARE UNISWAP POOLS ---`);

    


    ///////////////////////////
    // Deposit liquidity into the REIGN/WETH pair 
    ///////////////////////////
    let depositAmountReign = BigNumber.from(1000000).mul(tenPow18)
    let depositAmountWeth = BigNumber.from(1000).mul(tenPow18)
    tx = await reignToken.connect(c.user1Acct).approve(uniswapRouter.address, depositAmountReign)
    await tx.wait();
    tx = await weth.connect(c.user1Acct).approve(uniswapRouter.address, depositAmountWeth);
    await tx.wait();
    tx = await uniswapRouter.connect(c.user1Acct).addLiquidity(
            reignToken.address,
            weth.address,
            depositAmountReign,
            depositAmountWeth,
            1,
            1,
            c.user1Addr,
            Date.now() + 1000
        )
    await tx.wait();
    console.log(`Liquidity added to REIGN/WETH Pair`);


    return c;
}