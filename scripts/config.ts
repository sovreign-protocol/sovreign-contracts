import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract, Signer} from "ethers";
import {getAccount, impersonateAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {addMinutes} from "../test/helpers/helpers";
import {
    BasketBalancer,
    GovRewards,
    LiquidityBufferVault,
    LPRewards,
    Pool,
    PoolController,
    ReignDAO,
    ReignToken,
    RewardsVault,
    SvrToken,
    Staking,
    UniswapPairOracle,
    PoolRewards
} from "../typechain";

const REIGN_SUPPLY = BigNumber.from(1000000000).mul(helpers.tenPow18);

export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const user1Addr: string = '0x0F4ee9631f4be0a63756515141281A3E2B293Bbe'; // WETH whale
    const user2Addr: string = '0xE3DD3914aB28bB552d41B8dFE607355DE4c37A51'; // WBTC whale
    const user3Addr:string = '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';// Binance
    const usdcAddr: string = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const wbtcAddr: string = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
    const wethAddr: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const uniswapFactoryAddr: string = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const uniswapRouterAddr: string = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
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
        Math.floor(addMinutes(new Date(), 60).getTime() / 1000),
        // rewards amount
        BigNumber.from(610000).mul(helpers.tenPow18)
    )
}

export class DeployConfig {

    public sovReignOwnerAddr: string;
    public user1Addr: string;
    public user2Addr: string;
    public user3Addr: string;
    public usdcAddr: string;
    public wbtcAddr: string;
    public wethAddr: string;
    public uniswapFactoryAddr: string;
    public uniswapRouterAddr: string;
    public sovReignOwnerAcct: SignerWithAddress;
    public user1Acct: Signer;
    public user2Acct: Signer;
    public user3Acct: Signer;
    public amountReignTokenInitTotal: BigNumber;
    public amountReignTokenToSoVReignOwner: BigNumber;
    public amountReignTokenToRewardsVault: BigNumber;
    public amountReignTokenToUser1: BigNumber;
    public amountReignTokenToUser2: BigNumber;
    public epoch1stStartTs: number;
    public epochDuration: number;
    public rewardsAmount: BigNumber;
    // base contracts:
    public reignDiamond?: Contract;
    public rewardsVault?: RewardsVault;
    public devVault?: RewardsVault;
    public treasurySaleVault?: RewardsVault;
    public liquidityBufferVault?: LiquidityBufferVault;
    public usdc?: Contract;
    public wbtc?: Contract;
    public weth?: Contract;
    public reignToken?: ReignToken;
    public svrToken?: SvrToken;
    public govRewards?: GovRewards;
    public staking?: Staking;
    public lpRewards?: LPRewards;
    public reignDAO?: ReignDAO;
    public basketBalancer?: BasketBalancer;
    public poolController?: PoolController;
    public uniswapFactory?: Contract;
    public uniswapRouter?: Contract;
    public reignTokenOracle?: UniswapPairOracle;
    public oracle1?: UniswapPairOracle;
    public oracle2?: UniswapPairOracle;
    public pool1?: Pool;
    public pool2?: Pool;
    public pool1Rewards?: PoolRewards;
    public pool2Rewards?: PoolRewards;

    // Objects to carry context/scenario-specific data
    public scenario1?: any;

    constructor(
        sovReignOwnerAddr: string,
        user1Addr: string,
        user2Addr: string,
        user3Addr: string,
        usdcAddr: string,
        wbtcAddr: string,
        wethAddr: string,
        uniswapFactoryAddr: string,
        uniswapRouterAddr: string,
        sovReignOwnerAcct: SignerWithAddress,
        user1Acct: Signer,
        user2Acct: Signer,
        user3Acct: Signer,
        amountReignTokenInitTotal: BigNumber,
        amountReignTokenToSoVReignOwner: BigNumber,
        amountReignTokenToRewardsVault: BigNumber,
        amountReignTokenToUser1: BigNumber,
        amountReignTokenToUser2: BigNumber,
        epoch1stStartTs: number,
        epochDuration: number,
        rewardsAmount: BigNumber
    ) {

        this.sovReignOwnerAddr = sovReignOwnerAddr;
        this.user1Addr = user1Addr;
        this.user2Addr = user2Addr;
        this.user3Addr = user3Addr;
        this.usdcAddr = usdcAddr;
        this.wbtcAddr = wbtcAddr;
        this.wethAddr = wethAddr;
        this.uniswapFactoryAddr = uniswapFactoryAddr;
        this.uniswapRouterAddr = uniswapRouterAddr;
        this.sovReignOwnerAcct = sovReignOwnerAcct;
        this.user1Acct = user1Acct;
        this.user2Acct = user2Acct;
        this.user3Acct = user3Acct;
        this.amountReignTokenInitTotal = amountReignTokenInitTotal;
        this.amountReignTokenToSoVReignOwner = amountReignTokenToSoVReignOwner;
        this.amountReignTokenToRewardsVault = amountReignTokenToRewardsVault;
        this.amountReignTokenToUser1 = amountReignTokenToUser1;
        this.amountReignTokenToUser2 = amountReignTokenToUser2;
        this.epoch1stStartTs = epoch1stStartTs;
        this.epochDuration = epochDuration;
        this.rewardsAmount = rewardsAmount;
    }

}