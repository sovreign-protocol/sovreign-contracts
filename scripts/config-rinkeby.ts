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


export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '0xCDb2a435a65A5a90Da1dd2C1Fe78A2df70795F91';
    const user1Addr: string = '0xA5E3C2047a28f0C8032B1A7e7074682B129445a7'; 
    const user2Addr: string = '0x5577bd667608bBB2537f3d45610B14b7286466a7'; 
    const user3Addr: string = '0x2A95300047E373EEEAa5Eea0be7dcE1418Ccf191'; 
    const user4Addr:string = '0x2C48187E19780725EFC973620F4A1dF1c38481CA';
    const susdWhaleAddr:string = '0x2C48187E19780725EFC973620F4A1dF1c38481CA';
    const usdcAddr: string = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const sbtcAddr:  string = '0xA2E93bFb0250E41f2BbFAD4c6fED67c67f5eb381';
    const sethAddr:  string = '0x0955468eccd6d2ee06a5e47d0734a7508badf7a5';
    const sxauAddr: string = '0x19fc05cf36804bcaee77f27b48e103207fc70d89';
    const sxagAddr: string = '0x6c191f9f7af0a493a1623ddb41fe5cff386d128f';
    const schfAddr: string = '0x9380241b3851e27ded40f86837a58a9af29f81c3';
    const susdAddr: string = '0xd784369bfd4145fdd8645eaf8a5df3edf5d4a1a2';
    const wethAddr: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const bFactoryAddr: string = '0x9C84391B443ea3a48788079a5f98e2EaD55c9309'; 
    const smartPoolFactoryAddr: string = '0xA3F9145CB0B50D907930840BB2dcfF4146df8Ab4'; 
    const uniswapFactoryAddr: string = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    const uniswapRouterAddr:  string = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
     
    return new DeployConfig(
        sovReignOwnerAddr,
        user1Addr,
        user2Addr,
        user3Addr,
        user4Addr,
        susdWhaleAddr,
        usdcAddr,
        sbtcAddr,
        sethAddr,
        sxauAddr,
        sxagAddr,
        schfAddr,
        susdAddr,
        wethAddr,
        uniswapFactoryAddr,
        uniswapRouterAddr,
        bFactoryAddr,
        smartPoolFactoryAddr,
        await getAccount(sovReignOwnerAddr),
        await getAccount(user1Addr),
        await getAccount(user2Addr),
        await getAccount(user3Addr),
        await getAccount(user4Addr),
        await getAccount(susdWhaleAddr),
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
    public susdWhaleAddr: string;
    public usdcAddr: string;
    public sbtcAddr: string;
    public sethAddr: string;
    public sxauAddr: string;
    public sxagAddr: string;
    public schfAddr: string;
    public susdAddr: string;
    public wethAddr: string;
    public uniswapFactoryAddr: string;
    public uniswapRouterAddr: string;
    public bFactoryAddr: string;
    public smartPoolFactoryAddr: string;
    public sovReignOwnerAcct: SignerWithAddress;
    public user1Acct: Signer;
    public user2Acct: Signer;
    public user3Acct: Signer;
    public user4Acct: Signer;
    public susdWhale: Signer;
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
    public usdc?: Contract;
    public susd?: Contract;
    public schf?: Contract;
    public sbtc?: Contract;
    public seth?: Contract;
    public sxau?: Contract;
    public sxag?: Contract;
    public weth?: Contract;
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
        susdWhaleAddr: string,
        usdcAddr: string,
        sbtcAddr: string,
        sethAddr: string,
        sxauAddr: string,
        sxagAddr: string,
        schfAddr: string,
        susdAddr: string,
        wethAddr: string,
        uniswapFactoryAddr: string,
        uniswapRouterAddr: string,
        bFactoryAddr:string,
        smartPoolFactoryAddr: string,
        sovReignOwnerAcct: SignerWithAddress,
        user1Acct: Signer,
        user2Acct: Signer,
        user3Acct: Signer,
        user4Acct: Signer,
        susdWhale: Signer,
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
        this.susdWhaleAddr = susdWhaleAddr;
        this.usdcAddr = usdcAddr;
        this.sbtcAddr = sbtcAddr;
        this.sethAddr = sethAddr;
        this.sxauAddr = sxauAddr;
        this.sxagAddr = sxagAddr;
        this.schfAddr = schfAddr;
        this.susdAddr = susdAddr;
        this.wethAddr = susdAddr;
        this.uniswapFactoryAddr = uniswapFactoryAddr;
        this.uniswapRouterAddr = uniswapRouterAddr;
        this.bFactoryAddr = bFactoryAddr;
        this.smartPoolFactoryAddr = smartPoolFactoryAddr;
        this.sovReignOwnerAcct = sovReignOwnerAcct;
        this.user1Acct = user1Acct;
        this.user2Acct = user2Acct;
        this.user3Acct = user3Acct;
        this.user4Acct = user4Acct;
        this.susdWhale = susdWhale;
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