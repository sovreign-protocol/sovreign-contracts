import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract} from "ethers";
import {getAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {addMinutes} from "../test/helpers/helpers";
import {
    BasketBalancer,
    GovRewards,
    LiquidityBufferVault,
    PoolController,
    ReignDAO,
    ReignToken,
    RewardsVault,
    SvrToken
} from "../typechain";

export async function deployConfig(): Promise<DeployConfig> {
    const sovReignOwnerAddr: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const user1Addr: string = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const user2Addr: string = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    return new DeployConfig(
        sovReignOwnerAddr,
        user1Addr,
        user2Addr,
        await getAccount(sovReignOwnerAddr),
        await getAccount(user1Addr),
        await getAccount(user2Addr),
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
    public sovReignOwnerAcct: SignerWithAddress;
    public user1Acct: SignerWithAddress;
    public user2Acct: SignerWithAddress;
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
    public liquidityBufferVault?: LiquidityBufferVault;
    public reignToken?: ReignToken;
    public svrToken?: SvrToken;
    public govRewards?: GovRewards;
    public reignDAO?: ReignDAO;
    public basketBalancer?: BasketBalancer;
    public poolController?: PoolController;

    // Objects to carry context/scenario-specific data
    public scenario1?: any;

    constructor(
        sovReignOwnerAddr: string,
        user1Addr: string,
        user2Addr: string,
        sovReignOwnerAcct: SignerWithAddress,
        user1Acct: SignerWithAddress,
        user2Acct: SignerWithAddress,
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
        this.sovReignOwnerAcct = sovReignOwnerAcct;
        this.user1Acct = user1Acct;
        this.user2Acct = user2Acct;
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