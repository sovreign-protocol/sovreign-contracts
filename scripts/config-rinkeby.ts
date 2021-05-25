import {BigNumber} from "ethers";
import {getAccount, impersonateAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {DeployConfig} from "./config";


export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '0xCDb2a435a65A5a90Da1dd2C1Fe78A2df70795F91';
    const user1Addr: string = '0xA5E3C2047a28f0C8032B1A7e7074682B129445a7'; // WETH whale
    const user2Addr: string = '0x5577bd667608bBB2537f3d45610B14b7286466a7'; // WBTC whale
    const user3Addr: string = '0x2A95300047E373EEEAa5Eea0be7dcE1418Ccf191'; // Binance
    const usdcAddr:  string = '';
    const wbtcAddr:  string = '';
    const wethAddr:  string = '';
    const uniswapFactoryAddr: string = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const uniswapRouterAddr:  string = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const btcChainlinkOracle: string = '0xECe365B379E1dD183B20fc5f022230C044d51404';
    const wethChainlinkOracle:string = '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e';
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
        wethChainlinkOracle,
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