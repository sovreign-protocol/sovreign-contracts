import {BigNumber} from "ethers";
import {getAccount, impersonateAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {DeployConfig} from "./config";

const REIGN_SUPPLY = BigNumber.from(1000000000).mul(helpers.tenPow18);

export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '';
    const user1Addr: string = ''; // WETH whale
    const user2Addr: string = ''; // WBTC whale
    const user3Addr: string = ''; // Binance
    const usdcAddr: string = '';
    const wbtcAddr: string = '';
    const wethAddr: string = '';
    const uniswapFactoryAddr: string = '';
    const uniswapRouterAddr: string = '';
    const btcChainlinkOracle: string = '';
    return new DeployConfig(
        sovReignOwnerAddr,
        user1Addr,
        user2Addr,
        user3Addr,
        usdcAddr,
        wbtcAddr,
        wethAddr,
        uniswapFactoryAddr,
        uniswapRouterAddr,
        btcChainlinkOracle,
        await getAccount(sovReignOwnerAddr),
        await impersonateAccount(user1Addr),
        await impersonateAccount(user2Addr),
        await impersonateAccount(user3Addr),
        // Total REIGN token amount to be minted
        BigNumber.from(1000000000).mul(helpers.tenPow18),
        // REIGN token amount to 'sovReignOwnerAddr'
        BigNumber.from(250000000).mul(helpers.tenPow18),
        // REIGN token amount to 'RewardsVault'
        BigNumber.from(250000000).mul(helpers.tenPow18),
        // REIGN token amount to 'user1Addr'
        BigNumber.from(250000000).mul(helpers.tenPow18),
        // REIGN token amount to 'user2Addr'
        BigNumber.from(250000000).mul(helpers.tenPow18),
        // 1st epoch start timestamp (now)
        Math.floor(Date.now() / 1000),
        // epoch's duration (30 minutes from now)
        604800,
        // base Delta
        BigNumber.from(30).mul(BigNumber.from(10).pow(17)),
        // rewards amount
        BigNumber.from(610000).mul(helpers.tenPow18)
    )
}