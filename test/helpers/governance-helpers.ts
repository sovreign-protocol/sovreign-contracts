import { ethers } from 'hardhat';
import { BigNumber, ContractFactory } from 'ethers';
import { ReignDaoReignMock, ReignDao } from '../../typechain';

enum ProposalState {
    WarmUp,
    ReadyForActivation,
    Active,
    Canceled,
    Failed,
    Accepted,
    Queued,
    Grace,
    Expired,
    Executed
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const tenPow18 = BigNumber.from(10).pow(18);

export async function deployReign (): Promise<ReignDaoReignMock> {
    const ReignMock: ContractFactory = await ethers.getContractFactory('ReignDAOReignMock');
    const reign: ReignDaoReignMock = (await ReignMock.deploy()) as ReignDaoReignMock;
    await reign.deployed();

    return reign;
}

export async function deployReignDAO (): Promise<ReignDao> {
    const ReignDAO: ContractFactory = await ethers.getContractFactory('ReignDAO');
    const reignDAO: ReignDao = (await ReignDAO.deploy()) as ReignDao;
    await reignDAO.deployed();

    return reignDAO;
}

export async function getLatestBlock (): Promise<any> {
    return await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
}

export async function setNextBlockTimestamp (timestamp: number): Promise<void> {
    const block = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const currentTs = parseInt(block.timestamp);
    const diff = timestamp - currentTs;
    await ethers.provider.send('evm_increaseTime', [diff]);
}

export async function moveAtTimestamp (timestamp: number): Promise<void> {
    await setNextBlockTimestamp(timestamp);
    await ethers.provider.send('evm_mine', []);
}

export async function getCurrentBlockchainTimestamp (): Promise<number> {
    const block = await getLatestBlock();
    return parseInt(block.timestamp);
}