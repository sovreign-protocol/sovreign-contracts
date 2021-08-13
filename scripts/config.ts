import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract, Signer} from "ethers";
import {getAccount, impersonateAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";

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
    const sovReignOwnerAddr: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const user1Addr: string = '0x4F868C1aa37fCf307ab38D215382e88FCA6275E2'; 
    const user2Addr: string = '0xE3DD3914aB28bB552d41B8dFE607355DE4c37A51'; 
    const user3Addr:string = '0x55FE002aefF02F77364de339a1292923A15844B8';
    const user4Addr:string = '0x16463c0fdB6BA9618909F5b120ea1581618C1b9E';
    const susdWhaleAddr:string = '0xa5f7a39E55D7878bC5bd754eE5d6BD7a7662355b';// SUSD whale
    const usdcAddr: string = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const sbtcAddr:  string = '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6';
    const sethAddr:  string = '0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb';
    const sxauAddr: string = '0x261efcdd24cea98652b9700800a13dfbca4103ff';
    const sxagAddr: string = '0x6a22e5e94388464181578aa7a6b869e00fe27846';
    const schfAddr: string = '0x0f83287ff768d1c1e17a42f44d644d7f22e8ee1d';
    const susdAddr: string = '0x57ab1ec28d129707052df4df418d58a2d46d5f51';
    const wethAddr: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const bFactoryAddr: string = '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd'; 
    const smartPoolFactoryAddr: string = '0xed52D8E202401645eDAD1c0AA21e872498ce47D0'; 
    const uniswapFactoryAddr: string = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';
    const uniswapRouterAddr: string = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
    
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
        await impersonateAccount(user1Addr),
        await impersonateAccount(user2Addr),
        await impersonateAccount(user3Addr),
        await impersonateAccount(user4Addr),
        await impersonateAccount(susdWhaleAddr),
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