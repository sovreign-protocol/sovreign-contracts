import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {BigNumber, Contract} from "ethers";
import {getAccount} from "../test/helpers/accounts";
import * as helpers from "../test/helpers/helpers";
import {addMinutes} from "../test/helpers/helpers";
import {
    BasketBalancer,
    Governance,
    InterestStrategy,
    PoolController,
    ReignToken,
    Rewards,
    RewardsVault,
    SvrToken
} from "../typechain";

export async function deployConfig(): Promise<DeployConfig> {
    const _ownerAddr: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const _user1Addr: string = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const _user2Addr: string = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    return new DeployConfig(
        _ownerAddr,
        _user1Addr,
        _user2Addr,
        await getAccount(_ownerAddr),
        await getAccount(_user1Addr),
        await getAccount(_user2Addr),
        // REIGN token amount to 'RewardsVault'
        BigNumber.from(10000000).mul(helpers.tenPow18),
        // start timestamp (now)
        Math.floor(Date.now() / 1000),
        // end timestamp (30 minutes from now)
        Math.floor(addMinutes(new Date(), 30).getTime() / 1000),
        // rewards amount
        BigNumber.from(610000).mul(helpers.tenPow18)
    )
}

export class DeployConfig {

    private _ownerAddr: string;
    private _user1Addr: string;
    private _user2Addr: string;
    private _ownerAcct: SignerWithAddress;
    private _user1Acct: SignerWithAddress;
    private _user2Acct: SignerWithAddress;
    private _reignTokenAmountToRewardsVault: BigNumber;
    private _rewardsStartTs: number;
    private _rewardsEndTs: number;
    private _rewardsAmount: BigNumber;
    // contracts:
    private _reignDiamond?: Contract;
    private _rewardsVault?: RewardsVault;
    private _reignToken?: ReignToken;
    private _svrToken?: SvrToken;
    private _rewards?: Rewards;
    private _reignDAO?: Governance;
    private _basketBalancer?: BasketBalancer;
    private _interestStrategy?: InterestStrategy;
    private _poolController?: PoolController;


    constructor(ownerAddr: string, user1Addr: string, user2Addr: string, ownerAcct: SignerWithAddress,
                user1Acct: SignerWithAddress, user2Acct: SignerWithAddress, reignTokenAmountToRewardsVault: BigNumber,
                rewardsStartTs: number, rewardsEndTs: number,
                rewardsAmount: BigNumber, reignDiamond?: Contract, rewardsVault?: RewardsVault, reignToken?: ReignToken, svrToken?: SvrToken,
                rewards?: Rewards, reignDAO?: Governance, basketBalancer?: BasketBalancer, interestStrategy?: InterestStrategy,
                poolController?: PoolController) {
        this._ownerAddr = ownerAddr;
        this._user1Addr = user1Addr;
        this._user2Addr = user2Addr;
        this._ownerAcct = ownerAcct;
        this._user1Acct = user1Acct;
        this._user2Acct = user2Acct;
        this._reignTokenAmountToRewardsVault = reignTokenAmountToRewardsVault;
        this._rewardsStartTs = rewardsStartTs;
        this._rewardsEndTs = rewardsEndTs;
        this._rewardsAmount = rewardsAmount;
        this._reignDiamond = reignDiamond;
        this._rewardsVault = rewardsVault;
        this._reignToken = reignToken;
        this._svrToken = svrToken;
        this._rewards = rewards;
        this._reignDAO = reignDAO;
        this._basketBalancer = basketBalancer;
        this._interestStrategy = interestStrategy;
        this._poolController = poolController;
    }

    get ownerAddr(): string {
        return this._ownerAddr;
    }

    set ownerAddr(value: string) {
        this._ownerAddr = value;
    }

    get user1Addr(): string {
        return this._user1Addr;
    }

    set user1Addr(value: string) {
        this._user1Addr = value;
    }

    get user2Addr(): string {
        return this._user2Addr;
    }

    set user2Addr(value: string) {
        this._user2Addr = value;
    }

    get ownerAcct(): SignerWithAddress {
        return this._ownerAcct;
    }

    set ownerAcct(value: SignerWithAddress) {
        this._ownerAcct = value;
    }

    get user1Acct(): SignerWithAddress {
        return this._user1Acct;
    }

    set user1Acct(value: SignerWithAddress) {
        this._user1Acct = value;
    }

    get user2Acct(): SignerWithAddress {
        return this._user2Acct;
    }

    set user2Acct(value: SignerWithAddress) {
        this._user2Acct = value;
    }

    get reignTokenAmountToRewardsVault(): BigNumber {
        return this._reignTokenAmountToRewardsVault;
    }

    set reignTokenAmountToRewardsVault(value: BigNumber) {
        this._reignTokenAmountToRewardsVault = value;
    }

    get rewardsStartTs(): number {
        return this._rewardsStartTs;
    }

    set rewardsStartTs(value: number) {
        this._rewardsStartTs = value;
    }

    get rewardsEndTs(): number {
        return this._rewardsEndTs;
    }

    set rewardsEndTs(value: number) {
        this._rewardsEndTs = value;
    }

    get rewardsAmount(): BigNumber {
        return this._rewardsAmount;
    }

    set rewardsAmount(value: BigNumber) {
        this._rewardsAmount = value;
    }

    get reignDiamond(): Contract | undefined {
        return this._reignDiamond;
    }

    set reignDiamond(value: Contract | undefined) {
        this._reignDiamond = value;
    }

    get rewardsVault(): RewardsVault | undefined {
        return this._rewardsVault;
    }

    set rewardsVault(value: RewardsVault | undefined ) {
        this._rewardsVault = value;
    }

    get reignToken(): ReignToken | undefined {
        return this._reignToken;
    }

    set reignToken(value: ReignToken | undefined) {
        this._reignToken = value;
    }

    get svrToken(): SvrToken | undefined {
        return this._svrToken;
    }

    set svrToken(value: SvrToken | undefined) {
        this._svrToken = value;
    }

    get rewards(): Rewards | undefined {
        return this._rewards;
    }

    set rewards(value: Rewards | undefined) {
        this._rewards = value;
    }

    get reignDAO(): Governance | undefined {
        return this._reignDAO;
    }

    set reignDAO(value: Governance | undefined) {
        this._reignDAO = value;
    }

    get basketBalancer(): BasketBalancer | undefined {
        return this._basketBalancer;
    }

    set basketBalancer(value: BasketBalancer | undefined) {
        this._basketBalancer = value;
    }

    get interestStrategy(): InterestStrategy | undefined {
        return this._interestStrategy;
    }

    set interestStrategy(value: InterestStrategy | undefined) {
        this._interestStrategy = value;
    }

    get poolController(): PoolController | undefined {
        return this._poolController;
    }

    set poolController(value: PoolController | undefined) {
        this._poolController = value;
    }
}