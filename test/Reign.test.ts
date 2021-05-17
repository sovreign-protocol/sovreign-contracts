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


    let reign: ReignFacet, reignToken: ERC20Mock, changeRewards: ChangeRewardsFacet;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;

    let snapshotId: any;

    before(async function () {
        await setupSigners();
        reignToken = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;

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
        await reign.initReign(reignToken.address, startEpoch, duration);


        await helpers.setTime(await helpers.getCurrentUnix());
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

        it('can not be initialized with 0x0', async function () {
            await expect( reign.initReign(helpers.zeroAddress, startEpoch, duration)).to.be.revertedWith("Reign Token address must not be 0x0")
        });

        it('can not be initialized twice', async function () {
            await expect( reign.initReign(reignToken.address, startEpoch, duration)).to.be.revertedWith("Reign: already initialized")
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

            expect(await reignToken.transferFromCalled()).to.be.true;
            expect(await reignToken.balanceOf(reign.address)).to.be.equal(amount);
        });

        it('updates the total of reignToken locked', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            expect(await reign.reignStaked()).to.be.equal(amount);
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
            const multicall = (await deploy.deployContract('MulticallMock', [reign.address, reignToken.address, helpers.zeroAddress])) as MulticallMock;

            await reignToken.mint(multicall.address, amount.mul(5));

            await multicall.multiDeposit(amount);

            expect(await reign.balanceOf(multicall.address)).to.equal(amount.mul(3));
        });

        it('does not fail if rewards contract is set to address(0)', async function () {
            await changeRewards.changeRewardsAddress(helpers.zeroAddress);

            await prepareAccount(user, amount);
            await expect(reign.connect(user).deposit(amount)).to.not.be.reverted;
            expect(await reign.balanceOf(userAddress)).to.equal(amount);
        });
        it("deposit in middle of epoch 1", async function () {
            await prepareAccount(user,amount.mul(10))
            await helpers.moveAtEpoch(startEpoch,duration, 1);

            await helpers.setTime(getEpochStart(1) + Math.floor(duration / 2));

            await reign.connect(user).deposit(amount)

            const expectedMultiplier = multiplierAtTs(1, await helpers.getLatestBlockTimestamp());
            const expectedBalance = computeEffectiveBalance(amount, expectedMultiplier);

            expect(await getEpochUserBalance(userAddress, 1)).to.equal(expectedBalance);
            expect(await getEpochUserBalance(userAddress, 2)).to.equal(amount);

        });

        it("deposit epoch 1, deposit epoch 4", async function () {
            await prepareAccount(user,amount.mul(10))
            await helpers.moveAtEpoch(startEpoch,duration, 1);

            await helpers.setTime(getEpochStart(1) + Math.floor(duration / 2));
            await reign.connect(user).deposit(amount)

            await helpers.moveAtEpoch(startEpoch,duration, 4);

            await helpers.setTime(getEpochStart(4) + Math.floor(duration / 2));

            expect(await getEpochUserBalance(userAddress, 4)).to.equal(amount);

            await reign.connect(user).deposit(amount)

            const expectedMultiplier = multiplierAtTs(4, await helpers.getLatestBlockTimestamp());
            const totalMultiplier = calculateMultiplier(amount, BigNumber.from(1).mul(helpers.tenPow18), amount, expectedMultiplier);
            const expectedBalance = computeEffectiveBalance(amount.mul(2), totalMultiplier);

            expect(await getEpochUserBalance(userAddress, 4)).to.equal(expectedBalance);
            expect(await getEpochUserBalance(userAddress, 5)).to.equal(amount.mul(2));
        });

        it("deposit epoch 1, deposit epoch 2", async function () {
            await prepareAccount(user,amount.mul(10))
            await helpers.moveAtEpoch(startEpoch,duration, 1);
        
            await helpers.setTime(getEpochStart(1) + Math.floor(duration / 2));
            await reign.connect(user).deposit(amount)

            await helpers.moveAtEpoch(startEpoch,duration, 2);
            await helpers.setTime(getEpochStart(2) + Math.floor(duration / 2));

            expect(await getEpochUserBalance(userAddress, 2)).to.equal(amount);

            await reign.connect(user).deposit(amount)

            const expectedMultiplier = multiplierAtTs(2, await helpers.getLatestBlockTimestamp());
            const totalMultiplier = calculateMultiplier(amount, BigNumber.from(1).mul(helpers.tenPow18), amount, expectedMultiplier);
            const expectedBalance = computeEffectiveBalance(amount.mul(2), totalMultiplier);

            expect(await getEpochUserBalance(userAddress, 2)).to.equal(expectedBalance);
            expect(await getEpochUserBalance(userAddress, 3)).to.equal(amount.mul(2));
        });

        it("deposit epoch 1, deposit epoch 5, deposit epoch 5", async function () {
            await prepareAccount(user,amount.mul(10))
            await helpers.moveAtEpoch(startEpoch,duration, 1);
            await helpers.setTime(getEpochStart(1) + Math.floor(duration / 2));
            await reign.connect(user).deposit(amount)

            await helpers.moveAtEpoch(startEpoch,duration, 5);

            await helpers.setTime(getEpochStart(5) + Math.floor(duration / 2));
            await reign.connect(user).deposit(amount)

            const expectedMultiplier = multiplierAtTs(5, await helpers.getLatestBlockTimestamp());
            const totalMultiplier = calculateMultiplier(amount, BigNumber.from(1).mul(helpers.tenPow18), amount, expectedMultiplier);

            await helpers.setTime(getEpochStart(5) + Math.floor(duration * 3 / 4));
            await reign.connect(user).deposit(amount)

            const expectedMultiplier2 = multiplierAtTs(5, await helpers.getLatestBlockTimestamp());
            const totalMultiplier2 = calculateMultiplier(
                amount.mul(2),
                totalMultiplier,
                amount,
                expectedMultiplier2
            );
            const expectedBalance = computeEffectiveBalance(amount.mul(3), totalMultiplier2);

            expect(await getEpochUserBalance(userAddress, 5)).to.equal(expectedBalance);
            expect(await getEpochUserBalance(userAddress, 6)).to.equal(amount.mul(3));
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

        it('returns 0 if epoch older than first checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const epoch = (await reign.getEpoch()).toNumber();

            expect(await reign.getEpochUserBalance(userAddress, epoch - 1)).to.be.equal(0);
        });

        it('return correct balance if epoch newer than latest checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const epoch = (await reign.getEpoch()).toNumber();

            expect(await reign.getEpochUserBalance(userAddress, epoch + 1)).to.be.equal(amount);
        });

        it("Deposit at random points inside an epoch sets the correct effective balance", async function () {
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await prepareAccount(user, amount);

            const NUM_CHECKS = 5;
            for (let i = 0; i < NUM_CHECKS; i++) {
                const snapshotId = await ethers.provider.send("evm_snapshot", []);

                const ts = Math.floor(Math.random() * duration);

                await helpers.setTime(startEpoch + ts);
                await reign.connect(user).deposit(amount);

                const multiplier = multiplierAtTs(1, await helpers.getLatestBlockTimestamp());
                const expectedBalance = computeEffectiveBalance(amount, multiplier);

                expect(await reign.getEpochUserBalance(userAddress, 1)).to.equal(expectedBalance);
                expect(await reign.getEpochUserBalance(userAddress, 2)).to.equal(amount);

                await ethers.provider.send("evm_revert", [snapshotId]);
            }
        });
    });

    describe('balanceAtTs', function () {
        it('returns 0 if no checkpoint', async function () {
            const ts = await helpers.getLatestBlockTimestamp();
            expect(await reign.balanceAtTs(userAddress, ts)).to.be.equal(0);
        });

        it('returns 0 if timestamp older than first checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.balanceAtTs(userAddress, ts - 1)).to.be.equal(0);
        });

        it('return correct balance if timestamp newer than latest checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.balanceAtTs(userAddress, ts + 1)).to.be.equal(amount);
        });

        it('returns correct balance if timestamp between checkpoints', async function () {
            await prepareAccount(user, amount.mul(3));
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            await helpers.moveAtTimestamp(ts + 30);
            await reign.connect(user).deposit(amount);

            expect(await reign.balanceAtTs(userAddress, ts + 15)).to.be.equal(amount);

            await helpers.moveAtTimestamp(ts + 60);
            await reign.connect(user).deposit(amount);

            expect(await reign.balanceAtTs(userAddress, ts + 45)).to.be.equal(amount.mul(2));
        });
    });

    describe('reignStakedAtTs', function () {
        it('returns 0 if no checkpoint', async function () {
            const ts = await helpers.getLatestBlockTimestamp();
            expect(await reign.reignStakedAtTs(ts)).to.be.equal(0);
        });

        it('returns 0 if timestamp older than first checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.reignStakedAtTs(ts - 1)).to.be.equal(0);
        });

        it('returns correct balance if timestamp newer than latest checkpoint', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            expect(await reign.reignStakedAtTs(ts + 1)).to.be.equal(amount);
        });

        it('returns correct balance if timestamp between checkpoints', async function () {
            await prepareAccount(user, amount.mul(3));
            await reign.connect(user).deposit(amount);

            const ts = await helpers.getLatestBlockTimestamp();

            await helpers.moveAtTimestamp(ts + 30);
            await reign.connect(user).deposit(amount);

            expect(await reign.reignStakedAtTs(ts + 15)).to.be.equal(amount);

            await helpers.moveAtTimestamp(ts + 60);
            await reign.connect(user).deposit(amount);

            expect(await reign.reignStakedAtTs(ts + 45)).to.be.equal(amount.mul(2));
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
            await helpers.setTime(ts);

            await reign.connect(user).withdraw(amount.div(2));

            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(amount.div(2));
        });

        it("deposit epoch 1, withdraw twice in epoch 5", async function () {
            await prepareAccount(user, amount);
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setTime(ts);

            await reign.connect(user).withdraw(amount.div(3));
            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(amount.div(3).mul(2).add(1));//rounding

            await reign.connect(user).withdraw(amount.div(3));
            expect(await reign.getEpochUserBalance(userAddress, 5)).to.equal(amount.div(3).add(1));
        });

        it("deposit epoch 1, withdraw epoch 2", async function () {
            await prepareAccount(user, amount);
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 2);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setTime(ts);

            await reign.connect(user).withdraw(amount.div(2));
        });


        it("deposit epoch 1, deposit epoch 4, deposit epoch 5, withdraw epoch 5", async function () {
            await prepareAccount(user, amount.mul(10))
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);
            //deposit is made 1 block after epoch time, thus effective balance for epoch is with 1 block less
            let after = await helpers.getLatestBlockTimestamp()
            let balanceEffective = computeEffectiveBalance(amount, await multiplierAtTs(1, after));
            expect(await getEpochUserBalance(userAddress, 1)).to.be.equal(balanceEffective);

            await helpers.moveAtEpoch(startEpoch, duration, 4);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);
            await reign.connect(user).deposit(amount);
            expect(await getEpochUserBalance(userAddress, 2)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddress, 3)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddress, 6)).to.be.equal(amount.mul(3).toString());


            await reign.connect(user).withdraw( amount.mul(3));
            expect(await getEpochUserBalance(userAddress, 7)).to.be.equal("0");
        });

        it("deposit epoch 1, deposit epoch 3, withdraw epoch 3", async function () {
            await prepareAccount(user, amount.mul(2))
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount)
            let after = await helpers.getLatestBlockTimestamp()
            let multiplier = await multiplierAtTs(1, after);
            let balanceEffective = computeEffectiveBalance(amount, multiplier);
            expect(await getEpochUserBalance(userAddress, 1)).to.be.equal(balanceEffective);

            await helpers.moveAtEpoch(startEpoch, duration, 3);
            await reign.connect(user).deposit(amount)

            after = await helpers.getLatestBlockTimestamp()
            multiplier = await multiplierAtTs(3, after);
            balanceEffective = computeEffectiveBalance(amount, multiplier);
            expect(await getEpochUserBalance(userAddress, 3)).to.be.equal(amount.add(balanceEffective));


            await reign.connect(user).withdraw(amount.mul(2));
            expect(await getEpochUserBalance(userAddress, 3)).to.be.equal("0");

            expect(await getEpochUserBalance(userAddress, 2)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddress, 4)).to.be.equal("0");
        });

        it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 half amount", async function () {
            await prepareAccount(user, amount.mul(2));
            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setTime(ts);

            await reign.connect(user).deposit(amount);

            const ts1 = startEpoch + Math.floor(duration / 2);
            await helpers.setTime(ts1);

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

        it("deposit in epoch 0, deposit in epoch 1, deposit in epoch 2, withdraw in epoch 3", async function () {
            await prepareAccount(user, amount.mul(4))
            

            expect(await getEpochUserBalance(userAddress, 1)).to.be.equal("0");

            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);

            let after = await helpers.getLatestBlockTimestamp()
            let multiplier = await multiplierAtTs(1, after);
            let balanceEffective = computeEffectiveBalance(amount, multiplier);
            expect(await getEpochUserBalance(userAddress, 1)).to.be.equal(balanceEffective);

            await helpers.moveAtEpoch(startEpoch, duration, 2);
            await reign.connect(user).deposit(amount);

            after = await helpers.getLatestBlockTimestamp()
            multiplier = await multiplierAtTs(2, after);
            balanceEffective = computeEffectiveBalance(amount, multiplier);
            expect(await getEpochUserBalance(userAddress, 2)).to.be.equal(amount.add(balanceEffective));

            await helpers.moveAtEpoch(startEpoch, duration, 3);
            await reign.connect(user).deposit(amount);

            after = await helpers.getLatestBlockTimestamp()
            multiplier = await multiplierAtTs(3, after);
            balanceEffective = computeEffectiveBalance(amount, multiplier);
            //This sometimes fails by 100 due to blocks messing up timestamps
            expect(await getEpochUserBalance(userAddress, 3)).to.be.equal(amount.mul(2).add(balanceEffective));

            await helpers.moveAtEpoch(startEpoch, duration, 4);
            await reign.connect(user).withdraw(amount.mul(3));

            expect(await getEpochUserBalance(userAddress, 4)).to.be.equal("0");
        });

        it("deposit in epoch 1, withdraw in epoch 1", async function () {
            await prepareAccount(user, amount)
            

            await helpers.moveAtEpoch(startEpoch, duration, 1);
            await reign.connect(user).deposit(amount);

            let after = await helpers.getLatestBlockTimestamp()
            let multiplier = await multiplierAtTs(1, after);
            let balanceEffective = computeEffectiveBalance(amount, multiplier);
            expect(await getEpochUserBalance(userAddress, 1)).to.be.equal(balanceEffective);


            await reign.connect(user).withdraw( amount);

            expect(await reign.getEpochUserBalance(userAddress, 1)).to.equal("0");
        });

        it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 more than deposited", async function () {
            await prepareAccount(user, amount.mul(2));
            await helpers.moveAtEpoch(startEpoch, duration, 1);

            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration, 5);

            const ts = startEpoch + 24 * 60 * 60;
            await helpers.setTime(ts);

            await reign.connect(user).deposit(amount);

            const ts1 = startEpoch + Math.floor(duration / 2);
            await helpers.setTime(ts1);

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

            expect(await reignToken.balanceOf(reign.address)).to.be.equal(amount.mul(2));

            await reign.connect(user).withdraw(amount);

            expect(await reignToken.transferCalled()).to.be.true;
            expect(await reignToken.balanceOf(userAddress)).to.be.equal(amount);
            expect(await reignToken.balanceOf(reign.address)).to.be.equal(amount);
        });

        it('updates the total of reignToken locked', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            expect(await reign.reignStaked()).to.be.equal(amount);

            await reign.connect(user).withdraw(amount);
            expect(await reign.reignStaked()).to.be.equal(0);
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

            await helpers.setTime(await helpers.getCurrentUnix());

            await expect(
                reign.connect(user).lock(await helpers.getCurrentUnix() + (10 * time.day))
            ).to.be.revertedWith('Sender has no balance');
        });

        it('reverts if timestamp is in the past', async function () {
            await prepareAccount(user, amount);

            await helpers.setTime(await helpers.getCurrentUnix());

            await reign.connect(user).deposit(amount);
            await expect(reign.connect(user).lock(await helpers.getCurrentUnix() - (1 * time.year))
            ).to.be.revertedWith('Timestamp must be in the future');

        });

        it('reverts if user already has a lock and timestamp is lower', async function () {
            await prepareAccount(user, amount);

            await helpers.setTime(await helpers.getCurrentUnix());

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
            await prepareAccount(happyPirate, amount);
            await reign.connect(happyPirate).deposit(amount);

            let expiryTs = await helpers.getCurrentUnix() + (30 * time.day);
            await reign.connect(happyPirate).lock(expiryTs);

            expect(await reign.userLockedUntil(happyPirateAddress)).to.be.equal(expiryTs);

            expiryTs = await helpers.getCurrentUnix() + (1 * time.year);
            await reign.connect(happyPirate).lock(expiryTs);

            expect(await reign.userLockedUntil(happyPirateAddress)).to.be.equal(expiryTs);
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

            await helpers.setTime(expiryTs + 3600);

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

        it('returns expected multiplier at past epochs', async function () {
            helpers.moveAtEpoch(startEpoch, duration, 1)

            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            let ts = await helpers.getLatestBlockTimestamp();

            const lockExpiryTs = ts +time.year;
            await reign.connect(user).lock(lockExpiryTs);

            ts = await helpers.getLatestBlockTimestamp();
            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);

            await helpers.moveAtEpoch(startEpoch, duration, 2)
            //initialize epoch 2
            await reign.connect(user).deposit(amount);

            await helpers.moveAtEpoch(startEpoch, duration,4)

            const actualMultiplier = await reign.stakingBoostAtEpoch(userAddress, 2);

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


    describe('votingPowerAtTs', async function () {
        it('returns correct balance with no delegation', async function () {
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            const firstDepositTs = await helpers.getLatestBlockTimestamp();

            await helpers.setTime(firstDepositTs + 300);
            await reign.connect(user).deposit(amount);

            const secondDepositTs = await helpers.getLatestBlockTimestamp();

            expect(await reign.votingPowerAtTs(userAddress, firstDepositTs - 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(userAddress, firstDepositTs + 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(userAddress, secondDepositTs - 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(userAddress, secondDepositTs + 10)).to.be.equal(amount.mul(2));
        });

        it('returns correct balance with delegation', async function () {
            
            await prepareAccount(user, amount.mul(2));
            await reign.connect(user).deposit(amount);

            const depositTs = await helpers.getLatestBlockTimestamp();

            await helpers.setTime(depositTs + 50);
            await reign.connect(user).delegate(happyPirateAddress);

            const delegateTs = await helpers.getLatestBlockTimestamp();

            expect(await reign.votingPowerAtTs(userAddress, depositTs - 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(happyPirateAddress, depositTs - 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(userAddress, depositTs + 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(happyPirateAddress, depositTs + 10)).to.be.equal(0);

            expect(await reign.votingPowerAtTs(userAddress, delegateTs - 10)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(happyPirateAddress, delegateTs - 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(userAddress, delegateTs + 10)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(happyPirateAddress, delegateTs + 10)).to.be.equal(amount);
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

            await reign.connect(user).delegate(flyingParrotAddress);
            const delegate1Ts = await helpers.getLatestBlockTimestamp();

            await moveAtTimestamp(delegate1Ts + 100);
            await reign.connect(happyPirate).delegate(flyingParrotAddress);
            const delegate2Ts = await helpers.getLatestBlockTimestamp();

            await moveAtTimestamp(delegate2Ts + 100);
            await reign.connect(user).deposit(amount);
            const delegate3Ts = await helpers.getLatestBlockTimestamp();

            await moveAtTimestamp(delegate3Ts+100);
            await prepareAccount(flyingParrot, amount);
            await reign.connect(flyingParrot).deposit(amount);
            const depositTs = await helpers.getLatestBlockTimestamp();

            expect(await reign.votingPowerAtTs(flyingParrotAddress, depositTs -1)).to.be.equal(amount.mul(3));
            expect(await reign.votingPowerAtTs(flyingParrotAddress, delegate3Ts - 1)).to.be.equal(amount.mul(2));
            expect(await reign.votingPowerAtTs(flyingParrotAddress, delegate2Ts - 1)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(flyingParrotAddress, delegate1Ts - 1)).to.be.equal(0);
        });

        it('does not modify user balance', async function () {
            await prepareAccount(user, amount);
            await reign.connect(user).deposit(amount);
            await reign.connect(user).delegate(happyPirateAddress);

            expect(await reign.balanceOf(userAddress)).to.be.equal(amount);
        });

        it('works with multiple calls in the same block', async function () {
            const multicall = (await deploy.deployContract('MulticallMock', [reign.address, reignToken.address, helpers.zeroAddress])) as MulticallMock;

            await reignToken.mint(multicall.address, amount);

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
            const delegateTs = await helpers.getLatestBlockTimestamp();

            await reign.connect(user).stopDelegate();
            const stopTs = await helpers.getLatestBlockTimestamp();

            expect(await reign.votingPowerAtTs(happyPirateAddress, delegateTs - 1)).to.be.equal(0);
            expect(await reign.votingPowerAtTs(happyPirateAddress, stopTs - 1)).to.be.equal(amount);
            expect(await reign.votingPowerAtTs(happyPirateAddress, stopTs + 1)).to.be.equal(0);
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

    function getEpochStart(epoch: number) {
        return startEpoch + (epoch - 1) * duration;
    }

    async function getEpochUserBalance(addr: string, epochId: number) {
        return (await reign.getEpochUserBalance(addr,epochId)).toString();
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
        await reignToken.mint(await account.getAddress(), balance);
        await reignToken.connect(account).approve(reign.address, balance);
    }
});
