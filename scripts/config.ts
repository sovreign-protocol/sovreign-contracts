import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract, Signer} from "ethers";
import {getAccount, impersonateAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {addMinutes} from "../test/helpers/helpers";
import {day, hour, minute} from "../test/helpers/time";
import {
    BasketBalancer,
    GovRewards,
    LPRewards,
    ReignDAO,
    ReignToken,
    RewardsVault,
    Staking,
    SovWrapper,
    SovToken,
    PoolRouter,
    WrappingRewards,
} from "../typechain";

const REIGN_SUPPLY = BigNumber.from(1000000000).mul(helpers.tenPow18);

export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const user1Addr: string = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'; // WETH whale
    const user2Addr: string = '0xE3DD3914aB28bB552d41B8dFE607355DE4c37A51'; // WBTC whale
    const user3Addr:string = '0x55FE002aefF02F77364de339a1292923A15844B8';// USDC whale
    const user4Addr:string = '0x16463c0fdB6BA9618909F5b120ea1581618C1b9E';// DAI whale
    const user5Addr:string = '0x52F5F2adD61c835ff10550402A46621EBd1071D5';// PAXG whale
    const usdcAddr: string = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const daiAddr: string = '0x6b175474e89094c44da98b954eedeac495271d0f';
    const wbtcAddr: string = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
    const wethAddr: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const paxgAddr: string = '0x74271F2282eD7eE35c166122A60c9830354be42a';
    const bFactoryAddr: string = '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd'; 
    const smartPoolFactoryAddr: string = '0xed52D8E202401645eDAD1c0AA21e872498ce47D0'; 
    const uniswapFactoryAddr: string = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const uniswapRouterAddr: string = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    
    return new DeployConfig(
        sovReignOwnerAddr,
        user1Addr,
        user2Addr,
        user3Addr,
        user4Addr,
        user5Addr,
        usdcAddr,
        daiAddr,
        wbtcAddr,
        wethAddr,
        paxgAddr,
        uniswapFactoryAddr,
        uniswapRouterAddr,
        bFactoryAddr,
        smartPoolFactoryAddr,
        await getAccount(sovReignOwnerAddr),
        await impersonateAccount(user1Addr),
        await impersonateAccount(user2Addr),
        await impersonateAccount(user3Addr),
        await impersonateAccount(user4Addr),
        await impersonateAccount(user5Addr),
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

export class DeployConfig {

    public sovReignOwnerAddr: string;
    public user1Addr: string;
    public user2Addr: string;
    public user3Addr: string;
    public user4Addr: string;
    public user5Addr: string;
    public usdcAddr: string;
    public daiAddr: string;
    public wbtcAddr: string;
    public wethAddr: string;
    public paxgAddr:string;
    public uniswapFactoryAddr: string;
    public uniswapRouterAddr: string;
    public bFactoryAddr: string;
    public smartPoolFactoryAddr: string;
    public sovReignOwnerAcct: SignerWithAddress;
    public user1Acct: Signer;
    public user2Acct: Signer;
    public user3Acct: Signer;
    public user4Acct: Signer;
    public user5Acct: Signer;
    public amountReignTokenInitTotal: BigNumber;
    public amountReignTokenToSoVReignOwner: BigNumber;
    public amountReignTokenToRewardsVault: BigNumber;
    public amountReignTokenToUser1: BigNumber;
    public amountReignTokenToUser2: BigNumber;
    public epoch1stStartTs: number;
    public epochDuration: number;
    public baseDelta:BigNumber;
    public rewardsAmount: BigNumber;
    // base contracts:
    public reignDiamond?: Contract;
    public rewardsVault?: RewardsVault;
    public devVault?: RewardsVault;
    public treasurySaleVault?: RewardsVault;
    public dai?: Contract;
    public usdc?: Contract;
    public wbtc?: Contract;
    public weth?: Contract;
    public paxg?: Contract;
    public reignToken?: ReignToken;
    public sovToken?: SovToken;
    public govRewards?: GovRewards;
    public staking?: Staking;
    public sovLpRewards?: LPRewards;
    public reignLpRewards?: LPRewards;
    public reignDAO?: ReignDAO;
    public sovWrapper?:SovWrapper;
    public wrappingRewards?:WrappingRewards;
    public poolRouter?:PoolRouter;
    public basketBalancer?: BasketBalancer;
    public smartPool?: Contract;
    public smartPoolFactory?: Contract;
    public uniswapFactory?: Contract;
    public uniswapRouter?: Contract;
    // Objects to carry context/scenario-specific data
    public scenario1?: any;

    constructor(
        sovReignOwnerAddr: string,
        user1Addr: string,
        user2Addr: string,
        user3Addr: string,
        user4Addr: string,
        user5Addr: string,
        usdcAddr: string,
        daiAddr: string,
        wbtcAddr: string,
        wethAddr: string,
        paxgAddr: string,
        uniswapFactoryAddr: string,
        uniswapRouterAddr: string,
        bFactoryAddr:string,
        smartPoolFactoryAddr: string,
        sovReignOwnerAcct: SignerWithAddress,
        user1Acct: Signer,
        user2Acct: Signer,
        user3Acct: Signer,
        user4Acct: Signer,
        user5Acct: Signer,
        amountReignTokenInitTotal: BigNumber,
        amountReignTokenToSoVReignOwner: BigNumber,
        amountReignTokenToRewardsVault: BigNumber,
        amountReignTokenToUser1: BigNumber,
        amountReignTokenToUser2: BigNumber,
        epoch1stStartTs: number,
        epochDuration: number,
        baseDelta:BigNumber,
        rewardsAmount: BigNumber
    ) {

        this.sovReignOwnerAddr = sovReignOwnerAddr;
        this.user1Addr = user1Addr;
        this.user2Addr = user2Addr;
        this.user3Addr = user3Addr;
        this.user4Addr = user4Addr;
        this.user5Addr = user5Addr;
        this.usdcAddr = usdcAddr;
        this.daiAddr = daiAddr;
        this.wbtcAddr = wbtcAddr;
        this.wethAddr = wethAddr;
        this.paxgAddr = paxgAddr;
        this.uniswapFactoryAddr = uniswapFactoryAddr;
        this.uniswapRouterAddr = uniswapRouterAddr;
        this.bFactoryAddr = bFactoryAddr;
        this.smartPoolFactoryAddr = smartPoolFactoryAddr;
        this.sovReignOwnerAcct = sovReignOwnerAcct;
        this.user1Acct = user1Acct;
        this.user2Acct = user2Acct;
        this.user3Acct = user3Acct;
        this.user4Acct = user4Acct;
        this.user5Acct = user5Acct;
        this.amountReignTokenInitTotal = amountReignTokenInitTotal;
        this.amountReignTokenToSoVReignOwner = amountReignTokenToSoVReignOwner;
        this.amountReignTokenToRewardsVault = amountReignTokenToRewardsVault;
        this.amountReignTokenToUser1 = amountReignTokenToUser1;
        this.amountReignTokenToUser2 = amountReignTokenToUser2;
        this.epoch1stStartTs = epoch1stStartTs;
        this.epochDuration = epochDuration;
        this.baseDelta = baseDelta;
        this.rewardsAmount = rewardsAmount;
    }

}