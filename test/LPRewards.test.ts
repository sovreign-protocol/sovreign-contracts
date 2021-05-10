import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { moveAtEpoch, tenPow18 } from "./helpers/helpers";
import { deployContract } from "./helpers/deploy";
import { expect } from "chai";
import {RewardsVault, ERC20Mock, Staking, LPRewards} from "../typechain";

describe('YieldFarm AMM Pool', function () {
    let staking: Staking;
    let reignToken: ERC20Mock;
    let uniLP: ERC20Mock;
    let rewardsVault: RewardsVault;
    let yieldFarm: LPRewards;
    let creator: Signer, user: Signer;
    let userAddr: string;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;
    const numberOfEpochs = 100;

    const distributedAmount: BigNumber = BigNumber.from(2000000).mul(tenPow18);
    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;

    let snapshotId: any;

    before(async function () {
        [creator, user] = await ethers.getSigners();
        userAddr = await user.getAddress();

        staking = (await deployContract("Staking", [epochStart])) as Staking;
        reignToken = (await deployContract("ERC20Mock")) as ERC20Mock;
        uniLP = (await deployContract("ERC20Mock")) as ERC20Mock;

        rewardsVault = (await deployContract("RewardsVault", [reignToken.address])) as RewardsVault;
        yieldFarm = (await deployContract("LPRewards", [
            reignToken.address,
            uniLP.address,
            staking.address,
            rewardsVault.address,
        ])) as LPRewards;

        await reignToken.mint(rewardsVault.address, distributedAmount);
        await rewardsVault.connect(creator).setAllowance(yieldFarm.address, distributedAmount);
    });

    beforeEach(async function () {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async function () {
        await ethers.provider.send("evm_revert", [snapshotId]);
    });

    describe('General Contract checks', function () {
        it('should be deployed', async function () {
            expect(staking.address).to.not.equal(0)
            expect(yieldFarm.address).to.not.equal(0)
            expect(reignToken.address).to.not.equal(0)
        })

        it('Get epoch PoolSize and distribute tokens', async function () {
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 3)
            const totalAmount = amount

            expect(await yieldFarm.getPoolSize(1)).to.equal(totalAmount)
            expect(await yieldFarm.getEpochStake(userAddr, 1)).to.equal(totalAmount)
            expect(await reignToken.allowance(rewardsVault.address, yieldFarm.address)).to.equal(distributedAmount)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(2) // epoch on yield is staking - 1

            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(userAddr)).to.equal(distributedAmount.div(numberOfEpochs))
        })
    })

    describe('Contract Tests', function () {
        it('User harvest and mass Harvest', async function () {
            await depositLP(amount)
            const totalAmount = amount
            // initialize epochs meanwhile
            await moveAtEpoch(epochStart, epochDuration, 9)
            expect(await yieldFarm.getPoolSize(1)).to.equal(amount)

            expect(await yieldFarm.lastInitializedEpoch()).to.equal(0) // no epoch initialized
            await expect(yieldFarm.harvest(10)).to.be.revertedWith('This epoch is in the future')
            await expect(yieldFarm.harvest(3)).to.be.revertedWith('Can only harvest in order')
            await (await yieldFarm.connect(user).harvest(1)).wait()

            expect(await reignToken.balanceOf(userAddr)).to.equal(
                amount.mul(distributedAmount.div(numberOfEpochs)).div(totalAmount),
            )
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(1)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(1) // epoch 1 have been initialized

            await (await yieldFarm.connect(user).massHarvest()).wait()
            const totalDistributedAmount = amount.mul(distributedAmount.div(numberOfEpochs)).div(totalAmount).mul(7)
            expect(await reignToken.balanceOf(userAddr)).to.equal(totalDistributedAmount)
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(7)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(7) // epoch 7 have been initialized
        })
        it('lets only users with deposit harvest', async function () {
            //user account deposits
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 30)
            expect(await yieldFarm.getPoolSize(1)).to.equal(amount)

            //creator account harvests
            await yieldFarm.connect(creator).harvest(1)
            expect(await reignToken.balanceOf(await creator.getAddress())).to.equal(0)
            await yieldFarm.connect(creator).massHarvest()
            expect(await reignToken.balanceOf(await creator.getAddress())).to.equal(0)
        })
        it('massHarvests maximum 100 epochs', async function () {
            await depositLP(amount)
            const totalAmount = amount
            await moveAtEpoch(epochStart, epochDuration, 300)

            expect(await yieldFarm.getPoolSize(1)).to.equal(totalAmount)
            await (await yieldFarm.connect(user).massHarvest()).wait()
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(numberOfEpochs)
        })
        it('reverts if harvest is above 100', async function () {
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 103)
            await expect(yieldFarm.connect(user).harvest(101)).to.be.revertedWith("Maximum number of sizeAtEpoch is 100")
        })
        it('reverts if harvest init is not in order', async function () {
            await depositLP(amount)
            await depositLP(amount, creator)
            await moveAtEpoch(epochStart, epochDuration, 10)
            await expect(yieldFarm.connect(creator).harvest(5)).to.be.revertedWith("Can only harvest in order")
        })
        it('gives epochid = 0 for epochs before start', async function () {
            await moveAtEpoch(epochStart, epochDuration, -2)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(0)
        })
        it('harvests 0 if no deposit are made in an epoch', async function () {
            await moveAtEpoch(epochStart, epochDuration, 3)
            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(await user.getAddress())).to.equal(0)
        })
        it('harvests rewards for user only once', async function () {
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 3)
            await yieldFarm.connect(user).harvest(1)
            await expect(yieldFarm.connect(user).harvest(1)).to.be.revertedWith("Can only harvest in order")

            expect(await reignToken.balanceOf(await user.getAddress())).to.equal(
                distributedAmount.div(numberOfEpochs)
            )
        })

        it('inits an epoch only once', async function () {
            await depositLP(amount)
            await depositLP(amount, creator)
            await moveAtEpoch(epochStart, epochDuration, 3)

            await yieldFarm.connect(user).harvest(1)

            expect(await yieldFarm.lastInitializedEpoch()).to.equal(
                1
            )
            await yieldFarm.connect(creator).harvest(1)

            expect(await yieldFarm.lastInitializedEpoch()).to.equal(
                1
            )
        })
    })

    describe('Events', function () {
        it('Harvest emits Harvest', async function () {
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).harvest(1))
                .to.emit(yieldFarm, 'Harvest')
        })

        it('MassHarvest emits MassHarvest', async function () {
            await depositLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).massHarvest())
                .to.emit(yieldFarm, 'MassHarvest')
        })
    })

    async function depositLP (x:BigNumber, u = user) {
        const ua = await u.getAddress()
        await uniLP.mint(ua, x)
        await uniLP.connect(u).approve(staking.address, x)
        return await staking.connect(u).deposit(uniLP.address, x)
    }
})
