import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { moveAtEpoch, tenPow18,mineBlocks,setNextBlockTimestamp,getCurrentUnix, moveAtTimestamp, getLatestBlockTimestamp } from "./helpers/helpers";
import { deployContract, deployDiamond } from "./helpers/deploy";
import {diamondAsFacet} from "./helpers/diamond";
import * as time from './helpers/time';
import { expect } from "chai";
import { RewardsVault, ERC20Mock, StakingRewards, ReignFacet,ChangeRewardsFacet,EpochClockFacet} from "../typechain";

describe("Rewards", function () {
    let reignToken: ERC20Mock;
    let yieldFarm: StakingRewards;
    let reign: ReignFacet, changeRewards: ChangeRewardsFacet;
    let rewardsVault: RewardsVault;
    let user: Signer
    let flayingParrot: Signer;
    let userAddr: string;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;

    const distributedAmount: BigNumber = BigNumber.from(10000000).mul(tenPow18);
    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;

    let snapshotId: any;

    before(async function () {
        await setupSigners()
        userAddr = await user.getAddress();

        reignToken = (await deployContract("ERC20Mock")) as ERC20Mock;

        const cutFacet = await deployContract('DiamondCutFacet');
        const loupeFacet = await deployContract('DiamondLoupeFacet');
        const ownershipFacet = await deployContract('OwnershipFacet');
        const reignFacet = await deployContract('ReignFacet');
        const epochClockFacet = await deployContract('EpochClockFacet');
        const changeRewardsFacet = await deployContract('ChangeRewardsFacet');
        const diamond = await deployDiamond(
            'ReignDiamond',
            [cutFacet, loupeFacet, ownershipFacet, reignFacet, changeRewardsFacet,epochClockFacet],
            userAddr,
        );

        changeRewards = (await diamondAsFacet(diamond, 'ChangeRewardsFacet')) as ChangeRewardsFacet;
        reign = (await diamondAsFacet(diamond, 'ReignFacet')) as ReignFacet;
        await reign.initReign(reignToken.address, epochStart, epochDuration);


        rewardsVault = (await deployContract("RewardsVault", [reignToken.address])) as RewardsVault;
        
        yieldFarm = (await deployContract("StakingRewards", [
            reignToken.address,
            reign.address,
            rewardsVault.address,
        ])) as StakingRewards;

        await reignToken.mint(rewardsVault.address, distributedAmount);
        await rewardsVault.connect(user).setAllowance(yieldFarm.address, distributedAmount);

        await reignToken.mint(userAddr, amount);

        await setNextBlockTimestamp(await getCurrentUnix());
    });

    
    beforeEach(async function () {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async function () {
        await ethers.provider.send("evm_revert", [snapshotId]);
    });

    describe('General Contract checks', function () {
        it('should be deployed', async function () {
            expect(reign.address).to.not.equal(0)
            expect(yieldFarm.address).to.not.equal(0)
            expect(reignToken.address).to.not.equal(0)
        })

        it('Get epoch PoolSize and distribute tokens', async function () {
            await moveToEpoch(1)
            await depositReign(amount, user)
            await moveToEpoch(2)

            let poolSize = await yieldFarm.getPoolSize(await getLatestBlockTimestamp());
            expect(poolSize).to.equal(amount)
            expect(await yieldFarm.getEpochStake(userAddr, 1)).to.equal(amount)
            expect(
                await reignToken.allowance(rewardsVault.address, yieldFarm.address)
            ).to.equal(distributedAmount)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(await reign.getEpoch()) 
            expect(await yieldFarm.getCurrentEpoch()).to.equal(2) 

            
            // get epoch 1 rewards
            let epoch1Rewards = (await yieldFarm.getRewardsForEpoch(1));
            
            let balanceBeforeHarvest = await reignToken.balanceOf(userAddr)
            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(userAddr)).to.eq(balanceBeforeHarvest.add(epoch1Rewards));
        })
    })

    describe('Harvesting Tests', function () {
        it('User harvest and mass Harvest', async function () {
            await depositReign(amount)
            // initialize epochs meanwhile
            await moveToEpoch(1)
            await moveToEpoch(9)
            expect(await yieldFarm.getPoolSize(await getLatestBlockTimestamp())).to.equal(amount)

            expect(await yieldFarm.lastInitializedEpoch()).to.equal(0) // no epoch initialized
            await expect(yieldFarm.harvest(10)).to.be.revertedWith('This epoch is in the future')
            await expect(yieldFarm.harvest(3)).to.be.revertedWith('Harvest in order')

            let balanceBeforeHarvest = await reignToken.balanceOf(userAddr)

            await yieldFarm.connect(user).harvest(1)
            let epoch1Rewards = 
                (await yieldFarm.getRewardsForEpoch(1))

            let boostMultiplier = await yieldFarm.getBoost(userAddr, 1);
            
            // as the user didn't vote this epoch (see balancerMock) we need to apply Boost
            let distributedRewards = (epoch1Rewards).mul(boostMultiplier).div(tenPow18);
            expect(await reignToken.balanceOf(userAddr)).to.equal(
                distributedRewards.add(balanceBeforeHarvest)
            )
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(1)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(1) // epoch 1 have been initialized

            let balanceBeforeMassHarvest = await reignToken.balanceOf(userAddr)
            await (await yieldFarm.connect(user).massHarvest()).wait()
            const totalDistributedAmount = await totalAccrued(1,8)
            expect(await reignToken.balanceOf(userAddr)).to.equal(
                totalDistributedAmount.add(balanceBeforeMassHarvest)
                )
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(8)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(8) // epoch 8 has been initialized
        })
        it('harvests 0 if there is nothing to harvest', async function () {
            await moveToEpoch(1)
            //this initialises the epoch
            await depositReign(amount)
            await moveToEpoch(2)
            expect(await yieldFarm.getPoolSize(await getLatestBlockTimestamp())).to.equal(amount)

            //Flying Parrot has nothing to harvest
            let balanceBeforeHarvest = await reignToken.balanceOf(await flayingParrot.getAddress())
            await yieldFarm.connect(flayingParrot).harvest(1)
            expect(await reignToken.balanceOf(await flayingParrot.getAddress())).to.equal(balanceBeforeHarvest)
            await yieldFarm.connect(flayingParrot).massHarvest()
            expect(await reignToken.balanceOf(await flayingParrot.getAddress())).to.equal(balanceBeforeHarvest)
        })
        it('has nothing to harvest if no deposits are made', async function () {
            await moveToEpoch(1)
            //this initialises the epoch
            await depositReign(amount)
            await moveToEpoch(2)
            let balanceBeforeHarvest = await reignToken.balanceOf(await flayingParrot.getAddress());
            await yieldFarm.connect(flayingParrot).harvest(1)
            expect(await reignToken.balanceOf(await flayingParrot.getAddress())).to.equal(balanceBeforeHarvest)
        })
        it('gives epochid = 0 for previous epochs', async function () {
            await moveAtTimestamp(epochStart)
            await moveAtEpoch(epochStart, epochDuration, -2)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(0)
        })
    })

    describe('Boost', function () {
        it('Returns Boost for no lockup', async function () {
            moveToEpoch(1)
            await depositReign(amount)
            let boost = await yieldFarm.getBoost(userAddr, 1)

            await expect(boost)
                .to.be.eq(BigNumber.from(1).mul(tenPow18))
        })

        it('Returns Boost for lockup', async function () {
            await depositReign(amount)

            let ts = await getLatestBlockTimestamp();

            //1 Year lockup
            const lockExpiryTs = ts + 1000000;
            await reign.connect(user).lock(lockExpiryTs);
            
            ts = await getLatestBlockTimestamp();

            const expectedMultiplier = multiplierForLock(ts, lockExpiryTs);
            const actualMultiplier = await yieldFarm.getBoost(userAddr, await reign.getEpoch());

            expect(
                actualMultiplier
            ).to.be.equal(expectedMultiplier);
        })

        it('Adds Boost to harvest', async function () {
            await depositReign(amount)

            let ts = await getLatestBlockTimestamp();

            //1 Year lockup
            const lockExpiryTs = ts + 1000000;
            await reign.connect(user).lock(lockExpiryTs);

            let epochBoost = await yieldFarm.getBoost(userAddr, 1);

            // get epoch 1 rewards
            let epoch1Rewards = (await yieldFarm.getRewardsForEpoch(1));
            let boostedRewards = epoch1Rewards.mul(epochBoost).div(tenPow18);
            
            await moveToEpoch(2)
            let balanceBeforeHarvest = await reignToken.balanceOf(userAddr)
            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(userAddr)).to.eq(balanceBeforeHarvest.add(boostedRewards));
        })

        it('Adds Boost to Mass harvest', async function () {
            await depositReign(amount)

            let ts = await getLatestBlockTimestamp();

            //1 Year lockup
            const lockExpiryTs = ts + time.year;
            await reign.connect(user).lock(lockExpiryTs);

            await moveToEpoch(8)
            // get epoch 1 rewards
            let boostedRewards = await totalAccrued(0,7);
            let balanceBeforeHarvest = await reignToken.balanceOf(userAddr)
            await yieldFarm.connect(user).massHarvest()
            expect(await reignToken.balanceOf(userAddr)).to.eq(balanceBeforeHarvest.add(boostedRewards));
        })

    })
    describe('Events', function () {
        it('Harvest emits Harvest', async function () {
            await depositReign(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).harvest(1))
                .to.emit(yieldFarm, 'Harvest')
        })

        it('MassHarvest emits MassHarvest', async function () {
            await depositReign(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).massHarvest())
                .to.emit(yieldFarm, 'MassHarvest')
        })
    })

    async function moveToEpoch(n:number) {
        await moveAtEpoch(epochStart, epochDuration, n)
        
    }

    function multiplierForLock (ts: number, expiryTs: number): BigNumber {
        return BigNumber.from(expiryTs - ts)
            .mul(tenPow18)
            .div(time.year*2)
            .add(tenPow18);
    }


    async function totalAccrued(n:number, m:number) {
        let total = BigNumber.from(0);
        for(let i = n; i < m; i++){
            let epochBoost = await yieldFarm.getBoost(userAddr, i);
            let adjusted = epochBoost.mul((await yieldFarm.getRewardsForEpoch(i))).div(tenPow18)
            total = total.add(adjusted);
        }
        return total
    }

    async function depositReign(x: BigNumber, u = user) {
        const ua = await u.getAddress();
        await reignToken.mint(ua, x);
        await reignToken.connect(u).approve(reign.address, x);
        return await reign.connect(u).deposit(x);
    }


    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        flayingParrot = accounts[1];

    }

});
