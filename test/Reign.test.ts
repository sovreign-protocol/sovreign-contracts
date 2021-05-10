import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import * as helpers from './helpers/helpers';
import { expect } from 'chai';
import { ReignFacet, ERC20Mock, MulticallMock, ChangeRewardsFacet, EpochClockFacet } from '../typechain';
import * as time from './helpers/time';
import * as deploy from './helpers/deploy';
import {diamondAsFacet} from "./helpers/diamond";
import { moveAtTimestamp } from './helpers/helpers';
import { start } from 'repl';

describe('Reign', function () {
    const amount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));

    const startEpoch = helpers.getCurrentUnix();
    const duration = 604800;


    let reign: ReignFacet, bond: ERC20Mock, changeRewards: ChangeRewardsFacet;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;

    let snapshotId: any;

    before(async function () {
        await setupSigners();
        bond = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;

        const cutFacet = await deploy.deployContract('DiamondCutFacet');
        const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
        const ownershipFacet = await deploy.deployContract('OwnershipFacet');
        const reignFacet = await deploy.deployContract('ReignFacet');
        const changeRewardsFacet = await deploy.deployContract('ChangeRewardsFacet');
        const epochClockFacet = await deploy.deployContract('EpochClockFacet');
        const diamond = await deploy.deployDiamond(
            'ReignDiamond',
            [cutFacet, loupeFacet, ownershipFacet, reignFacet, changeRewardsFacet,epochClockFacet],
            userAddress,
        );

        changeRewards = (await diamondAsFacet(diamond, 'ChangeRewardsFacet')) as ChangeRewardsFacet;
        reign = (await diamondAsFacet(diamond, 'ReignFacet')) as ReignFacet;
        await reign.initReign(bond.address, startEpoch, duration);


        await helpers.setNextBlockTimestamp(await helpers.getCurrentUnix());
    });

    beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot', []);
    });

    afterEach(async function () {
        const ts = await helpers.getLatestBlockTimestamp();

        await ethers.provider.send('evm_revert', [snapshotId]);

        await helpers.moveAtTimestamp(ts + 5);
    });

    describe('General tests', function () {
        it('should be deployed', async function () {
            expect(reign.address).to.not.equal(0);
        });
    });

    describe('deposit', function () {
        it('reverts if called with 0', async function () {
            await expect(reign.connect(user).deposit(0)).to.be.revertedWith('Amount must be greater than 0');
        });

        it('reverts if user did not approve token', async function () {
            await expect(reign.connect(user).deposit(amount)).to.be.revertedWith('Token allowance too small');
        });

        it('updates last action checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.userLastAction(userAddress)).to.eq(await helpers.getLatestBlockTimestamp())
        });

        it('stores the user balance in storage', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.balanceOf(userAddress)).to.equal(amount);
        });

        it('transfers the user balance to itself', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await bond.transferFromCalled()).to.be.true;
            expect(await bond.balanceOf(reign.address)).to.be.equal(amount);
        });

        it('updates the total of bond locked', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.bondStaked()).to.be.equal(amount);
        });

        it('updates the delegated user\'s voting power if user delegated his balance', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.delegatedPower(happyPirateAddress)).to.be.equal(amount);

            await reign.connect(user).deposit(amount);

            expect(await reign.delegatedPower(happyPirateAddress)).to.be.equal(amount.mul(2));
        });

        it('works with multiple deposit in same block', async function () {
            const multicall = (await deploy.deployContract('MulticallMock', [reign.address, bond.address, helpers.zeroAddress])) as MulticallMock;

            await bond.mint(multicall.address, amount.mul(5));

            await multicall.multiDeposit(amount);

            expect(await reign.balanceOf(multicall.address)).to.equal(amount.mul(3));
        });

        it('does not fail if rewards contract is set to address(0)', async function () {
            await changeRewards.changeRewardsAddress(helpers.zeroAddress);

            await prepareAccount(user, amount);
            await expect(reign.connect(user).deposit(amount)).to.not.be.reverted;
            expect(await reign.balanceOf(userAddress)).to.equal(amount);
        });
    });

    describe('depositAndLock', function () {
        it('calls deposit and then lock', async function () {
            await prepareAccount(user, amount.mul(2));

            const ts = await helpers.getLatestBlockTimestamp();
            await expect(reign.connect(user).depositAndLock(amount, ts+3600)).to.not.be.reverted;
            expect(await reign.balanceOf(userAddress)).to.equal(amount);
            expect(await reign.userLockedUntil(userAddress)).to.equal(ts+3600);
        });
    });

    describe('getEpochUserBalance', function () {
        it('returns 0 if no checkpoint', async function () {
            const ts = (await reign.getEpoch()).toNumber();
            expect(await reign.getEpochUserBalance(userAddress, ts)).to.be.equal(0);
        });

        it('returns 0 if timestamp older than first checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = (await reign.getEpoch()).toNumber();

            expect(await reign.getEpochUserBalance(userAddress, ts - 1)).to.be.equal(0);
        });

        it('return correct balance if timestamp newer than latest checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = (await reign.getEpoch()).toNumber();

            expect(await reign.getEpochUserBalance(userAddress, ts + 1)).to.be.equal(amount);
        });

        it("Deposit at random points inside an epoch sets the correct effective balance", async function () {
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await prepareAccount(user, amount);

            const NUM_CHECKS = 5;
            for (let i = 0; i < NUM_CHECKS; i++) {
                const snapshotId = await ethers.provider.send("evm_snapshot", []);

                const ts = Math.floor(Math.random() * duration);

                await helpers.setNextBlockTimestamp(startEpoch + ts);
                await reign.connect(user).deposit(amount);

                const multiplier = multiplierAtTs(1, await helpers.getLatestBlockTimestamp());
                const expectedBalance = computeEffectiveBalance(amount, multiplier);

                expect(await reign.getEpochUserBalance(userAddress, 1)).to.equal(expectedBalance);
                expect(await reign.getEpochUserBalance(userAddress, 2)).to.equal(amount);

                await ethers.provider.send("evm_revert", [snapshotId]);
            }
        });
    });

    describe('bondStakedAtTs', function () {
        it('returns 0 if no checkpoint', async function () {
            const ts = await helpers.getLatestBlockTimestamp();
            expect(await reign.bondStakedAtTs(ts)).to.be.equal(0);
        });

        it('returns 0 if timestamp older than first checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.bondStakedAtTs(ts - 1)).to.be.equal(0);
        });

        it('returns correct balance if timestamp newer than latest checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.bondStakedAtTs(ts + 1)).to.be.equal(amount);
        });

        it('returns correct balance if timestamp between checkpoints', async function () {
            await prepareAccount(user, amount.mul(3));
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            await helpers.moveAtTimestamp(ts + 30);
            await reign.connect(user).deposit(amount);

            expect(await reign.bondStakedAtTs(ts + 15)).to.be.equal(amount);

            await helpers.moveAtTimestamp(ts + 60);
            await reign.connect(user).deposit(amount);

            expect(await reign.bondStakedAtTs(ts + 45)).to.be.equal(amount.mul(2));
        });
    });

    describe('withdraw', async function () {
        it('reverts if called with 0', async function () {
            await expect(reign.connect(user).withdraw(0)).to.be.revertedWith('Amount must be greater than 0');
        });

        it('reverts if user does not have enough balance', async function () {
            await expect(reign.connect(user).withdraw(amount)).to.be.revertedWith('Insufficient balance');
        });

        it('updates last action checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.userLastAction(userAddress)).to.eq(await helpers.getLatestBlockTimestamp())
        });

        it('sets user balance to 0', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.connect(user).withdraw(amount)).to.not.throw;
            expect(await reign.balanceOf(userAddress)).to.be.equal(0);
        });

        it("deposit epoch 1, withdraw epoch 5", async function () {
            await prepareAccount(user, amount);
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setNextBlockTimestamp(ts);

            await reign.connect(user).withdraw(amount.div(2));

            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(amount.div(2));
        });

        it("deposit epoch 1, withdraw epoch 2", async function () {
            await prepareAccount(user, amount);
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 2);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setNextBlockTimestamp(ts);

            await reign.connect(user).withdraw(amount.div(2));
        });

        it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 half amount", async function () {
            await prepareAccount(user, amount.mul(2));
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setNextBlockTimestamp(ts);

            await reign.connect(user).deposit(amount);

            const ts1 = startEpoch + Math.floor(duration / 2);
            await helpers.setNextBlockTimestamp(ts1);

            const balance = await reign.getEpochUserBalance(userAddress, 5);

            await reign.connect(user).withdraw( amount.div(2));

            const avgDepositMultiplier = BigNumber.from(balance).sub(amount)
                .mul(BigNumber.from(1).mul(helpers.tenPow18))
                .div(amount);

            const postWithdrawMultiplier = calculateMultiplier(
                amount,
                BigNumber.from(1).mul(helpers.tenPow18),
                amount.div(2),
                avgDepositMultiplier
            );

            const expectedBalance = computeEffectiveBalance(amount.add(amount.div(2)), postWithdrawMultiplier);

            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(expectedBalance);
            expect(await reign.getEpochUserBalance(userAddress, 6)).to.equal(amount.add(amount.div(2)));
        });

        it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 more than deposited", async function () {
            await prepareAccount(user, amount.mul(2));
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setNextBlockTimestamp(ts);

            await reign.connect(user).deposit(amount);

            const ts1 = startEpoch + Math.floor(duration / 2);
            await helpers.setNextBlockTimestamp(ts1);

            await reign.connect(user).withdraw(amount.add(amount.div(2)));

            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(amount.div(2));
            expect(await reign.getEpochUserBalance(userAddress, 6)).to.equal(amount.div(2));
        });

        it('does not affect old checkpoints', async function () {
            await prepareAccount(user, amount);
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);
            
            await helpers.moveAtEpoch(startEpoch, duration, 3);

            await reign.connect(user).withdraw(amount);
            //withdrawing in epoch 3 doesn't change epoch 2 balance
            expect(await reign.getEpochUserBalance(userAddress, 2)).to.be.equal(amount);
        });

        it('transfers balance to the user', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount.mul(2));

            expect(await bond.balanceOf(reign.address)).to.be.equal(amount.mul(2));

            await reign.connect(user).withdraw(amount);

            expect(await bond.transferCalled()).to.be.true;
            expect(await bond.balanceOf(userAddress)).to.be.equal(amount);
            expect(await bond.balanceOf(reign.address)).to.be.equal(amount);
        });

        it('updates the total of bond locked', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            expect(await reign.bondStaked()).to.be.equal(amount);

            await reign.connect(user).withdraw(amount);
            expect(await reign.bondStaked()).to.be.equal(0);
        });

        it('updates the delegated user\'s voting power if user delegated his balance', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.delegatedPower(happyPirateAddress)).to.be.equal(amount);

            await reign.connect(user).withdraw(amount);

            expect(await reign.delegatedPower(happyPirateAddress)).to.be.equal(0);
        });
    });

    describe('lock', async function () {
        it('reverts if timestamp is more than MAX_LOCK', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const MAX_LOCK = (await reign.MAX_LOCK()).toNumber();

            await expect(
                reign.connect(user).lock(await helpers.getCurrentUnix() + (5 * MAX_LOCK))
            ).to.be.revertedWith('Timestamp too big');

            await expect(
                reign.connect(user).lock(await helpers.getCurrentUnix() + (180 * time.day))
            ).to.not.be.reverted;
        });

        it('reverts if user does not have balance', async function () {

            await helpers.setNextBlockTimestamp(await helpers.getCurrentUnix());

            await expect(
                reign.connect(user).lock(await helpers.getCurrentUnix() + (10 * time.day))
            ).to.be.revertedWith('Sender has no balance');
        });

        it('reverts if user already has a lock and timestamp is lower', async function () {
            await prepareAccount(user, amount);

            await helpers.setNextBlockTimestamp(await helpers.getCurrentUnix());

            await reign.connect(user).deposit(amount);
            await reign.connect(user).lock(await helpers.getCurrentUnix() + (1 * time.year));

            await expect(
                reign.connect(user).lock(await helpers.getCurrentUnix() + (5 * time.day))
            ).to.be.revertedWith('New timestamp lower than current lock timestamp');
        });

        it('sets lock correctly', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const expiryTs = await helpers.getCurrentUnix() + (1 * time.year);
            await reign.connect(user).lock(expiryTs);

            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTs);
        });

        it('sets lock correctly if called twice in epoch', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const expiryTs = await helpers.getCurrentUnix() + (time.year);
            await reign.connect(user).lock(expiryTs);
            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTs);

            const expiryTsNew = await helpers.getLatestBlockTimestamp() + (time.day + time.year);
            await reign.connect(user).lock(expiryTsNew);
            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTsNew);
        });

        it('sets lock correctly if called in epoch after with no deposits', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const expiryTs = await helpers.getCurrentUnix() + (time.year);
            await reign.connect(user).lock(expiryTs);
            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTs);

            helpers.moveAtEpoch(startEpoch, duration, (await reign.getEpoch()).add(1).toNumber())

            const expiryTsNew = await helpers.getLatestBlockTimestamp() + (time.day + time.year);
            await reign.connect(user).lock(expiryTsNew);
            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTsNew);
        });

        it('allows user to increase lock', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            await helpers.setNextBlockTimestamp(await helpers.getCurrentUnix());

            await reign.connect(user).lock(await helpers.getCurrentUnix() + (30 * time.day));

            const expiryTs = await helpers.getCurrentUnix() + (1 * time.year);
            await expect(reign.connect(user).lock(expiryTs)).to.not.be.reverted;
            expect(await reign.userLockedUntil(userAddress)).to.be.equal(expiryTs);
        });

        it('does not block deposits for user', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            await reign.connect(user).lock(await helpers.getCurrentUnix() + (30 * time.day));

            await expect(reign.connect(user).deposit(amount)).to.not.be.reverted;
            expect(await reign.balanceOf(userAddress)).to.be.equal(amount.mul(2));
        });

        it('blocks withdrawals for user during lock', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            const expiryTs = await helpers.getCurrentUnix() + (30 * time.day);
            await reign.connect(user).lock(expiryTs);

            await expect(reign.connect(user).withdraw(amount)).to.be.revertedWith('User balance is locked');
            expect(await reign.balanceOf(userAddress)).to.be.equal(amount);

            await helpers.setNextBlockTimestamp(expiryTs + 3600);

            await expect(reign.connect(user).withdraw(amount)).to.not.be.reverted;
            expect(await reign.balanceOf(userAddress)).to.be.equal(0);
        });
    });


    describe('stakingBoost', function () {
        it('returns the current multiplier of the user', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);


            let ts = await helpers.getLatestBlockTimestamp();
            const lockExpiryTs = ts + time.year;
            await reign.connect(user).lock(lockExpiryTs);
             ts = await helpers.getLatestBlockTimestamp();

            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            const actualMultiplier = await reign.stakingBoost(userAddress);

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });
    });

    describe('stakingBoostAtEpoch', async function () {
        it('returns expected multiplier for a two year lock', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            //over 2 Year lockup
            const lockExpiryTs = ts + (time.year*2);
            await reign.connect(user).lock(lockExpiryTs);

            ts = await helpers.getLatestBlockTimestamp();

            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            const actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });

        it('returns base multiplier if no lockup', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const expectedMultiplier = BigNumber.from(1).mul(helpers.tenPow18);
            const actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });

        it('multiplier is propagated through epoch', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            //over 2 Year lockup
            const lockExpiryTs = ts + (time.year*2);
            await reign.connect(user).lock(lockExpiryTs);

            ts = await helpers.getLatestBlockTimestamp();

            
            await helpers.moveAtEpoch(startEpoch, duration, (await reign.getEpoch()).toNumber() + 2)

            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            const actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });

        it('returns expected multiplier', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            //1 Year lockup
            const lockExpiryTs = ts + time.year;
            await reign.connect(user).lock(lockExpiryTs);
            
            ts = await helpers.getLatestBlockTimestamp();

            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            const actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });

        it('returns 0 after lock expired', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            //1 Year lockup
            const lockExpiryTs = ts + 10000;
            await reign.connect(user).lock(lockExpiryTs);
            
            ts = await helpers.getLatestBlockTimestamp();

            let expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            let actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);

            await helpers.moveAtTimestamp(lockExpiryTs+10)

             expectedMultiplier = BigNumber.from(1).mul(helpers.tenPow18)
             actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });

        it('sets multiplier correctly if called twice in epoch', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            const lockExpiryTs = ts + time.day;
            await reign.connect(user).lock(lockExpiryTs);
            
            ts = await helpers.getLatestBlockTimestamp();

            let expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            let actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());
            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);

            // increase lock in same epoch
            const lockExpiryTsNew = ts + (time.day*2);
            await reign.connect(user).lock(lockExpiryTsNew);
            
            ts = await helpers.getLatestBlockTimestamp();

            expectedMultiplier = multiplierForLock(ts, lockExpiryTsNew);
            actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, await reign.getEpoch());
            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        });
    });

    describe('votingPower', async function () {
        it('returns raw balance', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.votingPower(userAddress)).to.be.equal(amount);
        });
    });

    describe('votingPowerAtEpoch', async function () {
        it('returns correct balance with no lock', async function () {
            await prepareAccount(user, amount.mul(2));

            //deposit at Epoch 2
            await helpers.moveAtEpoch(startEpoch, duration, 2);
            await reign.connect(user).deposit(amount);

            //deposit more at Epoch 3
            await helpers.moveAtEpoch(startEpoch, duration, 3);
            await reign.connect(user).deposit(amount);


            expect(await reign.votingPowerAtEpoch(userAddress, 1)).to.be.equal(0);
            expect(await reign.votingPowerAtEpoch(userAddress, 2)).to.be.equal(amount);
            expect(await reign.votingPowerAtEpoch(userAddress, 3)).to.be.equal(amount.mul(2));
        });
    });

    describe('votingPowerAtTs', async function () {
        it('returns correct balance with no lock', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            const firstDepositTs = await helpers.getLatestBlockTimestamp();

            await helpers.setNextBlockTimestamp(firstDepositTs + 30 * time.day);
            await reign.connect(user).deposit(amount);

            const secondDepositTs = await helpers.getLatestBlockTimestamp();

            expect(await reign.votingPowerAtTs(userAddress, firstDepositTs - 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(userAddress, firstDepositTs + 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(userAddress, secondDepositTs - 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(userAddress, secondDepositTs + 10)).to.be.equal(amount.mul(2));
        });
    });

    describe('delegate', async function () {
        it('reverts if user delegates to self', async function () {
            await expect(reign.connect(user).delegate(userAddress)).to.be.revertedWith("Can't delegate to self");
        });

        it('reverts if user does not have balance', async function () {
            await prepareAccount(user, amount);

            await expect(reign.connect(user).delegate(happyPirateAddress))
                .to.be.revertedWith('No balance to delegate');

            await reign.connect(user).deposit(amount);

            await expect(reign.connect(user).delegate(happyPirateAddress)).to.not.be.reverted;
        });

        it('sets the correct voting powers for delegate and delegatee', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(amount);
            expect(await reign.votingPower(userAddress)).to.be.equal(0);
        });

        it('sets the correct voting power if delegatee has own balance', async function () {
            await prepareAccount(user, amount);
            await prepareAccount(happyPirate, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(happyPirate).deposit(amount);

            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(amount.mul(2));
            expect(await reign.votingPower(userAddress)).to.be.equal(0);
        });

        it('sets the correct voting power if delegatee receives from multiple users', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(flyingParrotAddress);

            await prepareAccount(happyPirate, amount);
            await reign.connect(happyPirate).deposit(amount);
            await reign.connect(happyPirate).delegate(flyingParrotAddress);

            expect(await reign.votingPower(flyingParrotAddress)).to.be.equal(amount.mul(2));

            await prepareAccount(flyingParrot, amount);
            await reign.connect(flyingParrot).deposit(amount);

            expect(await reign.votingPower(flyingParrotAddress)).to.be.equal(amount.mul(3));
        });

        it('records history of delegated power', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            await prepareAccount(happyPirate, amount);
            await reign.connect(happyPirate).deposit(amount);

            // amount is delegated in this epoch
            await reign.connect(user).delegate(flyingParrotAddress);
            const delegate1Epoch = (await reign.getEpoch()).toNumber() 

            // another amount is delegated in the epoch after the first
            await helpers.moveAtEpoch(startEpoch, duration, delegate1Epoch + 1);
            await reign.connect(happyPirate).delegate(flyingParrotAddress);
            const delegate2Epoch = (await reign.getEpoch()).toNumber() 

            // amount is deposited in the third epoch after, automatically delegated
            await helpers.moveAtEpoch(startEpoch, duration, delegate2Epoch + 1);
            await reign.connect(user).deposit(amount);
            const delegate3Epoch = (await reign.getEpoch()).toNumber() 

            // amount is deposited in the third epoch after, not delegated
            await helpers.moveAtEpoch(startEpoch, duration, delegate3Epoch + 1);
            await prepareAccount(flyingParrot, amount);
            await reign.connect(flyingParrot).deposit(amount);
            const depositEpoch = (await reign.getEpoch()).toNumber() 

            expect(await reign.votingPowerAtEpoch(flyingParrotAddress, delegate1Epoch - 1)).to.be.equal(0);
            expect(await reign.votingPowerAtEpoch(flyingParrotAddress, delegate1Epoch)).to.be.equal(amount);
            expect(await reign.votingPowerAtEpoch(flyingParrotAddress, delegate2Epoch)).to.be.equal(amount.mul(2));
            expect(await reign.votingPowerAtEpoch(flyingParrotAddress, delegate3Epoch)).to.be.equal(amount.mul(3));
            expect(await reign.votingPowerAtEpoch(flyingParrotAddress, depositEpoch)).to.be.equal(amount.mul(4));
        });

        it('does not modify user balance', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.balanceOf(userAddress)).to.be.equal(amount);
        });

        it('works with multiple calls in the same block', async function () {
            const multicall = (await deploy.deployContract('MulticallMock', [reign.address, bond.address, helpers.zeroAddress])) as MulticallMock;

            await bond.mint(multicall.address, amount);

            await multicall.multiDelegate(amount, userAddress, happyPirateAddress);

            expect(await reign.delegatedPower(userAddress)).to.equal(amount);
            expect(await reign.delegatedPower(happyPirateAddress)).to.equal(0);
        });

        it('works when delegation is updated many epochs after', async function () {
            await prepareAccount(user, amount);
            helpers.moveAtEpoch(startEpoch, duration, 5)
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(flyingParrotAddress);

            expect(await reign.votingPower(flyingParrotAddress)).to.be.equal(amount);

            helpers.moveAtEpoch(startEpoch, duration, 20)

            //edit delegation
            await reign.connect(user).delegate(happyPirateAddress);
            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(amount);
        });
    });

    describe('stopDelegate', async function () {
        it('removes delegated voting power from delegatee and returns it to user', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.votingPower(userAddress)).to.be.equal(0);
            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(amount);

            await reign.connect(user).stopDelegate();

            expect(await reign.votingPower(userAddress)).to.be.equal(amount);
            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(0);
        });

        it('preserves delegate history', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);
            const delegateEpoch = (await reign.getEpoch()).toNumber()
            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(amount);

            await helpers.moveAtEpoch(startEpoch, duration, delegateEpoch +1)

            await reign.connect(user).stopDelegate();
            expect(await reign.votingPower(happyPirateAddress)).to.be.equal(0);

            const stopEpoch = (await reign.getEpoch()).toNumber()

            expect(await reign.votingPowerAtEpoch(happyPirateAddress, delegateEpoch - 1)).to.be.equal(0);
            expect(await reign.votingPowerAtEpoch(happyPirateAddress, stopEpoch - 1)).to.be.equal(amount);
            expect(await reign.votingPowerAtEpoch(happyPirateAddress, stopEpoch)).to.be.equal(0);
            expect(await reign.votingPowerAtEpoch(happyPirateAddress, stopEpoch + 1)).to.be.equal(0);
        });

        it('does not change any other delegated balances for the delegatee', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(flyingParrotAddress);

            await prepareAccount(happyPirate, amount);
            await reign.connect(happyPirate).deposit(amount);
            await reign.connect(happyPirate).delegate(flyingParrotAddress);

            expect(await reign.votingPower(flyingParrotAddress)).to.be.equal(amount.mul(2));

            await reign.connect(user).stopDelegate();

            expect(await reign.votingPower(flyingParrotAddress)).to.be.equal(amount);
        });
    });

    describe('events', async function () {
        it('emits Deposit on call to deposit()', async function () {
            await prepareAccount(happyPirate, amount);

            await expect(reign.connect(happyPirate).deposit(amount))
                .to.emit(reign, 'Deposit').and.not.emit(reign, 'DelegatedPowerIncreased');
        });

        it('emits Deposit & DelegatedPowerIncreased on call to deposit() with delegated power', async function () {
            await prepareAccount(happyPirate, amount.mul(2));
            await reign.connect(happyPirate).deposit(amount);

            await reign.connect(happyPirate).delegate(flyingParrotAddress);

            await expect(reign.connect(happyPirate).deposit(amount))
                .to.emit(reign, 'Deposit')
                .and.to.emit(reign, 'DelegatedPowerIncreased');
        });

        it('emits Withdraw on call to withdraw()', async function () {
            await prepareAccount(happyPirate, amount.mul(2));
            await reign.connect(happyPirate).deposit(amount);

            await expect(reign.connect(happyPirate).withdraw(amount))
                .to.emit(reign, 'Withdraw')
                .and.not.to.emit(reign, 'DelegatedPowerDecreased');
        });

        it('emits Withdraw & DelegatedPowerDecreased on call to withdraw() with delegated power', async function () {
            await prepareAccount(happyPirate, amount.mul(2));
            await reign.connect(happyPirate).deposit(amount.mul(2));
            await reign.connect(happyPirate).delegate(flyingParrotAddress);

            await expect(reign.connect(happyPirate).withdraw(amount))
                .to.emit(reign, 'Withdraw')
                .and.to.emit(reign, 'DelegatedPowerDecreased');
        });

        it('emits correct events on delegate', async function () {
            await prepareAccount(happyPirate, amount.mul(2));
            await reign.connect(happyPirate).deposit(amount.mul(2));

            // when a user delegates without currently delegating, we should see the following events
            await expect(reign.connect(happyPirate).delegate(flyingParrotAddress))
                .to.emit(reign, 'Delegate')
                .and.to.emit(reign, 'DelegatedPowerIncreased')
                .and.not.to.emit(reign, 'DelegatedPowerDecreased');

            // when a user changes the user they delegate to, we should see the following events
            await expect(reign.connect(happyPirate).delegate(userAddress))
                .to.emit(reign, 'Delegate')
                .and.to.emit(reign, 'DelegatedPowerIncreased')
                .and.to.emit(reign, 'DelegatedPowerDecreased');

            // on stopDelegate, it should emit a Delegate(user, address(0)) event
            await expect(reign.connect(happyPirate).stopDelegate())
                .to.emit(reign, 'Delegate')
                .and.to.emit(reign, 'DelegatedPowerDecreased')
                .and.not.to.emit(reign, 'DelegatedPowerIncreased');
        });

        it('emits Lock event on call to lock()', async function () {
            await prepareAccount(happyPirate, amount.mul(2));
            await reign.connect(happyPirate).deposit(amount.mul(2));

            const ts = await helpers.getLatestBlockTimestamp();
            await expect(reign.connect(happyPirate).lock(ts + 3600))
                .to.emit(reign, 'Lock');
        });
    });



    function computeEffectiveBalance(balance: BigNumber, multiplier: BigNumber) {
        return balance.mul(multiplier).div(BigNumber.from(1).mul(helpers.tenPow18));
    }

    function multiplierAtTs(epoch: number, ts: number) {
        const epochEnd = startEpoch + epoch * duration;
        const timeLeft = epochEnd - ts;

        return BigNumber.from(timeLeft).mul(BigNumber.from(1).mul(helpers.tenPow18)).div(duration);
    }

    function scaleMultiplier(floatValue: number, currentDecimals: number) {
        const value = floatValue * Math.pow(10, currentDecimals);

        return BigNumber.from(value).mul(BigNumber.from(10).pow(18 - currentDecimals));
    }

    function calculateMultiplier(previousBalance: BigNumber, previousMultiplier: BigNumber, newDeposit: BigNumber, newMultiplier: BigNumber) {
        const pb = BigNumber.from(previousBalance);
        const pm = BigNumber.from(previousMultiplier);
        const nd = BigNumber.from(newDeposit);
        const nm = BigNumber.from(newMultiplier);

        const pa = pb.mul(pm).div(BigNumber.from(1).mul(helpers.tenPow18));
        const na = nd.mul(nm).div(BigNumber.from(1).mul(helpers.tenPow18));

        return pa.add(na).mul(BigNumber.from(1).mul(helpers.tenPow18)).div(pb.add(nd));
    }

    function multiplierForLock (ts: number, expiryTs: number): BigNumber {
        return BigNumber.from(expiryTs - ts)
            .mul(helpers.tenPow18)
            .div(time.year*2)
            .add(helpers.tenPow18);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        happyPirate = accounts[3];
        flyingParrot = accounts[4];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
        flyingParrotAddress = await flyingParrot.getAddress();
    }

    async function prepareAccount (account: Signer, balance: BigNumber) {
        await bond.mint(await account.getAddress(), balance);
        await bond.connect(account).approve(reign.address, balance);
    }
});
