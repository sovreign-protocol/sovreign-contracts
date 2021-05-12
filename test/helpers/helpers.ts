// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {ethers} from 'hardhat';
import {BigNumber, Contract} from 'ethers';

export const zeroAddress = '0x0000000000000000000000000000000000000000';
export const stakingEpochStart = 1603065600;
export const stakingEpochDuration = 604800;
export const tenPow18 = BigNumber.from(10).pow(18);
export const baseAdjustment = BigNumber.from(1).mul(tenPow18)


export function getCurrentUnix() {
    return Math.floor(Date.now() / 1000);
}

export async function moveAtEpoch(start: number, duration: number, epoch: number) {
    await setTime(start + duration * (epoch-1));
    await ethers.provider.send("evm_mine", []);
}

export async function getLatestBlock(): Promise<any> {
    return await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
}

export async function getLatestBlockTimestamp(): Promise<number> {
    return parseInt((await getLatestBlock()).timestamp);
}

export async function setTime(timestamp: number): Promise<void> {
    const block = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const currentTs = parseInt(block.timestamp);
    const diff = timestamp - currentTs;
    await ethers.provider.send('evm_increaseTime', [diff]);
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
    const block = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
    const currentTs = parseInt(block.timestamp);
    const timeInFuture = timestamp + currentTs;
    await ethers.provider.send('evm_setNextBlockTimestamp', [timeInFuture]);
}

export async function increaseBlockTime(timestamp: number): Promise<void> {
    await setNextBlockTimestamp(timestamp);
    await ethers.provider.send('evm_mine', []);
}

export async function moveAtTimestamp(timestamp: number): Promise<void> {
    await setTime(timestamp);
    await ethers.provider.send('evm_mine', []);
}

export async function mineBlocks(blocks: number): Promise<void> {
    for (let i=0; i<blocks;i++){
        await ethers.provider.send('evm_mine', [await getLatestBlockTimestamp()  + 10 ]);
    }
}

export async function getCurrentEpoch(): Promise<number> {
    const currentBlockTs = parseInt((await getLatestBlock()).timestamp);

    if (currentBlockTs < stakingEpochStart) {
        return 0;
    }

    return Math.floor((currentBlockTs - stakingEpochStart) / stakingEpochDuration) + 1;
}

export async function contractAt(name: string, address: string): Promise<Contract> {
    return await ethers.getContractAt(name, address);
}
export async function setAutomine(val: boolean) {
    await ethers.provider.send("evm_setAutomine", [val])
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + (minutes * 60000));
}