import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract} from "ethers";
import {getAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {addMinutes} from "../test/helpers/helpers";
import {
    BasketBalancer,
    ReignDAO,
    InterestStrategy,
    PoolController,
    ReignToken,
    Rewards,
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
        // start timestamp (now)
        Math.floor(Date.now() / 1000),
        // end timestamp (30 minutes from now)
        Math.floor(addMinutes(new Date(), 30).getTime() / 1000),
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
    public rewardsStartTs: number;
    public rewardsEndTs: number;
    public rewardsAmount: BigNumber;
    // contracts:
    public reignDiamond?: Contract;
    public rewardsVault?: RewardsVault;
    public reignToken?: ReignToken;
    public svrToken?: SvrToken;
    public rewards?: Rewards;
    public reignDAO?: ReignDAO;
    public basketBalancer?: BasketBalancer;
    public interestStrategy?: InterestStrategy;
    public poolController?: PoolController;

    constructor(sovReignOwnerAddr: string, user1Addr: string, user2Addr: string, sovReignOwnerAcct: SignerWithAddress, user1Acct: SignerWithAddress, user2Acct: SignerWithAddress, amountReignTokenInitTotal: BigNumber, amountReignTokenToSoVReignOwner: BigNumber, amountReignTokenToRewardsVault: BigNumber, amountReignTokenToUser1: BigNumber, amountReignTokenToUser2: BigNumber, rewardsStartTs: number, rewardsEndTs: number, rewardsAmount: BigNumber, reignDiamond?: Contract, rewardsVault?: RewardsVault, reignToken?: ReignToken, svrToken?: SvrToken, rewards?: Rewards, reignDAO?: ReignDAO, basketBalancer?: BasketBalancer, interestStrategy?: InterestStrategy, poolController?: PoolController) {
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
        this.rewardsStartTs = rewardsStartTs;
        this.rewardsEndTs = rewardsEndTs;
        this.rewardsAmount = rewardsAmount;
        this.reignDiamond = reignDiamond;
        this.rewardsVault = rewardsVault;
        this.reignToken = reignToken;
        this.svrToken = svrToken;
        this.rewards = rewards;
        this.reignDAO = reignDAO;
        this.basketBalancer = basketBalancer;
        this.interestStrategy = interestStrategy;
        this.poolController = poolController;
    }

// get ownerAddr(): string {
    //     return this._ownerAddr;
    // }
    //
    // set ownerAddr(value: string) {
    //     this._ownerAddr = value;
    // }
    //
    // get user1Addr(): string {
    //     return this._user1Addr;
    // }
    //
    // set user1Addr(value: string) {
    //     this._user1Addr = value;
    // }
    //
    // get user2Addr(): string {
    //     return this._user2Addr;
    // }
    //
    // set user2Addr(value: string) {
    //     this._user2Addr = value;
    // }
    //
    // get ownerAcct(): SignerWithAddress {
    //     return this._ownerAcct;
    // }
    //
    // set ownerAcct(value: SignerWithAddress) {
    //     this._ownerAcct = value;
    // }
    //
    // get user1Acct(): SignerWithAddress {
    //     return this._user1Acct;
    // }
    //
    // set user1Acct(value: SignerWithAddress) {
    //     this._user1Acct = value;
    // }
    //
    // get user2Acct(): SignerWithAddress {
    //     return this._user2Acct;
    // }
    //
    // set user2Acct(value: SignerWithAddress) {
    //     this._user2Acct = value;
    // }
    //
    // get amountReignTokenToSoVReignOwner(): BigNumber {
    //     return this._amountReignTokenToSoVReignOwner;
    // }
    // set amountReignTokenToSoVReignOwner(value: BigNumber) {
    //     this._amountReignTokenToSoVReignOwner = value;
    // }
    //
    // get amountReignTokenToRewardsVault(): BigNumber {
    //     return this._amountReignTokenToRewardsVault;
    // }
    // set amountReignTokenToRewardsVault(value: BigNumber) {
    //     this._amountReignTokenToRewardsVault = value;
    // }
    //
    // get amountReignTokenToUser1(): BigNumber {
    //     return this._amountReignTokenToUser1;
    // }
    // set amountReignTokenToUser1(value: BigNumber) {
    //     this._amountReignTokenToUser1 = value;
    // }
    //
    // get amountReignTokenToUser2(): BigNumber {
    //     return this._amountReignTokenToUser2;
    // }
    // set amountReignTokenToUser2(value: BigNumber) {
    //     this._amountReignTokenToUser2 = value;
    // }
    //
    // get rewardsStartTs(): number {
    //     return this._rewardsStartTs;
    // }
    //
    // set rewardsStartTs(value: number) {
    //     this._rewardsStartTs = value;
    // }
    //
    // get rewardsEndTs(): number {
    //     return this._rewardsEndTs;
    // }
    //
    // set rewardsEndTs(value: number) {
    //     this._rewardsEndTs = value;
    // }
    //
    // get rewardsAmount(): BigNumber {
    //     return this._rewardsAmount;
    // }
    //
    // set rewardsAmount(value: BigNumber) {
    //     this._rewardsAmount = value;
    // }
    //
    // get reignDiamond(): Contract | undefined {
    //     return this._reignDiamond;
    // }
    //
    // set reignDiamond(value: Contract | undefined) {
    //     this._reignDiamond = value;
    // }
    //
    // get rewardsVault(): RewardsVault | undefined {
    //     return this._rewardsVault;
    // }
    //
    // set rewardsVault(value: RewardsVault | undefined ) {
    //     this._rewardsVault = value;
    // }
    //
    // get reignToken(): ReignToken | undefined {
    //     return this._reignToken;
    // }
    //
    // set reignToken(value: ReignToken | undefined) {
    //     this._reignToken = value;
    // }
    //
    // get svrToken(): SvrToken | undefined {
    //     return this._svrToken;
    // }
    //
    // set svrToken(value: SvrToken | undefined) {
    //     this._svrToken = value;
    // }
    //
    // get rewards(): Rewards | undefined {
    //     return this._rewards;
    // }
    //
    // set rewards(value: Rewards | undefined) {
    //     this._rewards = value;
    // }
    //
    // get reignDAO(): Governance | undefined {
    //     return this._reignDAO;
    // }
    //
    // set reignDAO(value: Governance | undefined) {
    //     this._reignDAO = value;
    // }
    //
    // get basketBalancer(): BasketBalancer | undefined {
    //     return this._basketBalancer;
    // }
    //
    // set basketBalancer(value: BasketBalancer | undefined) {
    //     this._basketBalancer = value;
    // }
    //
    // get interestStrategy(): InterestStrategy | undefined {
    //     return this._interestStrategy;
    // }
    //
    // set interestStrategy(value: InterestStrategy | undefined) {
    //     this._interestStrategy = value;
    // }
    //
    // get poolController(): PoolController | undefined {
    //     return this._poolController;
    // }
    //
    // set poolController(value: PoolController | undefined) {
    //     this._poolController = value;
    // }
}