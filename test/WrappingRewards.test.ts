import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { moveAtEpoch, tenPow18,mineBlocks,setTime,getCurrentUnix, moveAtTimestamp } from "./helpers/helpers";
import { deployContract } from "./helpers/deploy";
import { expect } from "chai";
import { 
        RewardsVault, ERC20Mock, WrapSVR, WrappingRewards, 
        RouterMock, ReignBalancerMock,
        BasketBalancerMock, EpochClockMock, PoolRouter
    } from "../typechain";

describe("Wrapping Rewards", function () {
    let wrapper: WrapSVR;
    let reignToken: ERC20Mock;
    let underlyingToken: ERC20Mock;
    let balancerLP: ERC20Mock;
    let router:RouterMock;
    let wrappingRewards: WrappingRewards;
    let basketBalancer: BasketBalancerMock;
    let rewardsVault: RewardsVault;
    let epochClock:EpochClockMock
    let creator: Signer, user: Signer;
    let reignMock: ReignBalancerMock;
    let treasury: Signer;
    let userAddr: string;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;

    const distributedAmount: BigNumber = BigNumber.from(500000000).mul(tenPow18);
    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;

    let snapshotId: any;

    before(async function () {
        await setupSigners()
        userAddr = await user.getAddress();


        epochClock = (await deployContract('EpochClockMock', [epochStart])) as EpochClockMock;

        reignToken = (await deployContract("ERC20Mock")) as ERC20Mock;
        underlyingToken = (await deployContract("ERC20Mock")) as ERC20Mock;
        balancerLP = (await deployContract("ERC20Mock")) as ERC20Mock;

        reignMock = (await deployContract("ReignBalancerMock")) as ReignBalancerMock;
        basketBalancer = (await deployContract("BasketBalancerMock", [[],[],await reignMock.address])) as BasketBalancerMock;
        
        wrapper = (await deployContract("WrapSVR", [])) as WrapSVR;
    
        router = (await deployContract("RouterMock", [balancerLP.address, wrapper.address])) as RouterMock;

        await wrapper.initialize(
            epochClock.address,  
            await creator.getAddress(), 
            balancerLP.address,
            await router.address
        )


        rewardsVault = (await deployContract("RewardsVault", [reignToken.address])) as RewardsVault;

        wrappingRewards = (await deployContract("WrappingRewards", [
            reignToken.address,
            balancerLP.address,
            basketBalancer.address,
            wrapper.address,
            rewardsVault.address
        ])) as WrappingRewards;


        await reignToken.mint(rewardsVault.address, distributedAmount);
        await rewardsVault.connect(creator).setAllowance(wrappingRewards.address, distributedAmount);

        await setTime(await getCurrentUnix());
    });

    
    beforeEach(async function () {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async function () {
        await ethers.provider.send("evm_revert", [snapshotId]);
    });

    describe('General Contract checks', function () {
        it('should be deployed', async function () {
            expect(wrapper.address).to.not.equal(0)
            expect(wrappingRewards.address).to.not.equal(0)
            expect(reignToken.address).to.not.equal(0)
        })

        it('Get epoch PoolSize and distribute tokens', async function () {
            await depositUnderlying(amount)

            
            await MoveToEpoch(1)
            await MoveToEpoch(2)
            await MoveToEpoch(3)
            const totalAmount = amount

            expect(await wrappingRewards.getPoolSize(1)).to.equal(totalAmount)
            expect(await wrappingRewards.getEpochStake(userAddr, 1)).to.equal(totalAmount)
            expect(
                await reignToken.allowance(rewardsVault.address, wrappingRewards.address)
            ).to.equal(distributedAmount)
            expect(await wrappingRewards.getCurrentEpoch()).to.equal(2) // epoch on yield is wrapper - 1

            let epoch1Rewards = (await wrappingRewards.getRewardsForEpoch(1));
            let boostMultiplier = await wrappingRewards.getBoost(userAddr, 1);
            
            // as the user didn't vote this epoch (see balancerMock) we need to apply Boost
            let distributedRewards = (epoch1Rewards).mul(boostMultiplier).div(tenPow18);

            expect(distributedRewards).to.not.eq(0)
            await wrappingRewards.connect(user).harvest(1)
            expect(await reignToken.balanceOf(userAddr)).to.eq(distributedRewards)
        })
    })

    describe('Harvesting Tests', function () {
        it('User harvest and mass Harvest', async function () {
            await depositUnderlying(amount)
            const totalAmount = amount
            // initialize epochs meanwhile
            await MoveToEpoch(1)
            await MoveToEpoch(2)
            await MoveToEpoch(3)
            await MoveToEpoch(4)
            await MoveToEpoch(5)
            await MoveToEpoch(6)
            await MoveToEpoch(7)
            await MoveToEpoch(8)
            await MoveToEpoch(9)
            expect(await wrappingRewards.getPoolSize(1)).to.equal(amount)

            expect(await wrappingRewards.lastInitializedEpoch()).to.equal(0) // no epoch initialized
            await expect(wrappingRewards.harvest(10)).to.be.revertedWith('This epoch is in the future')
            await expect(wrappingRewards.harvest(3)).to.be.revertedWith('Can only harvest in order')
            await wrappingRewards.connect(user).harvest(1)
            let epoch1Rewards = 
                (await wrappingRewards.getRewardsForEpoch(1))

            let boostMultiplier = await wrappingRewards.getBoost(userAddr, 1);
            
            // as the user didn't vote this epoch (see balancerMock) we need to apply Boost
            let distributedRewards = (epoch1Rewards).mul(boostMultiplier).div(tenPow18);
            expect(await reignToken.balanceOf(userAddr)).to.equal(
                distributedRewards
            )
            expect(await wrappingRewards.connect(user).userLastEpochIdHarvested()).to.equal(1)
            expect(await wrappingRewards.lastInitializedEpoch()).to.equal(1) // epoch 1 have been initialized

            await (await wrappingRewards.connect(user).massHarvest()).wait()
            const totalDistributedAmount = await totalAccruedUntilEpoch(8)
            expect(await reignToken.balanceOf(userAddr)).to.equal(totalDistributedAmount)
            expect(await wrappingRewards.connect(user).userLastEpochIdHarvested()).to.equal(7)
            expect(await wrappingRewards.lastInitializedEpoch()).to.equal(7) // epoch 7 has been initialized
        })

        it('gives epochid = 0 for previous epochs', async function () {
            await moveAtTimestamp(epochStart)
            await moveAtEpoch(epochStart, epochDuration, -2)
            expect(await wrappingRewards.getCurrentEpoch()).to.equal(0)
        })
        it('it should return 0 if no deposit in an epoch', async function () {
            await moveAtTimestamp(epochStart)
            await moveAtEpoch(epochStart, epochDuration, 3)
            await wrappingRewards.connect(user).harvest(1)
            expect(await reignToken.balanceOf(await user.getAddress())).to.equal(0)
        })
        it('harvests rewards for user only once', async function () {
            await depositUnderlying(amount)
            await moveAtEpoch(epochStart, epochDuration, 3)
            await wrappingRewards.connect(user).harvest(1)
            await expect(wrappingRewards.connect(user).harvest(1)).to.be.revertedWith("Can only harvest in order")

            expect(await reignToken.balanceOf(await user.getAddress())).to.equal(
                await totalAccruedUntilEpoch(2)
            )
        })

        it('inits an epoch only once', async function () {
            await depositUnderlying(amount)
            await depositUnderlying(amount, creator)
            await moveAtEpoch(epochStart, epochDuration, 3)

            await wrappingRewards.connect(user).harvest(1)

            expect(await wrappingRewards.lastInitializedEpoch()).to.equal(
                1
            )
            await wrappingRewards.connect(creator).harvest(1)

            expect(await wrappingRewards.lastInitializedEpoch()).to.equal(
                1
            )
        })
    })

    describe('Events', function () {
        it('Harvest emits Harvest', async function () {
            await depositUnderlying(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(wrappingRewards.connect(user).harvest(1))
                .to.emit(wrappingRewards, 'Harvest')
        })

        it('MassHarvest emits MassHarvest', async function () {
            await depositUnderlying(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(wrappingRewards.connect(user).massHarvest())
                .to.emit(wrappingRewards, 'MassHarvest')
        })
    })

    async function MoveToEpoch(n:number) {
        await moveAtEpoch(epochStart, epochDuration, n)
        
    }

    async function totalAccruedUntilEpoch(n:number) {
        let total = BigNumber.from(0);
        for(let i = 1; i < n; i++){
            let epochBoost = await wrappingRewards.getBoost(userAddr, i);
            let adjusted = epochBoost.mul(await wrappingRewards.getRewardsForEpoch(i)).div(tenPow18)
            total = total.add(adjusted);
        }
        return total
    }

    async function depositUnderlying(x: BigNumber, u = user) {
        const ua = await u.getAddress();
        await underlyingToken.mint(ua, x);
        await underlyingToken.connect(u).approve(router.address, x);
        return await router.connect(u).deposit(
            underlyingToken.address,
            x,
            x,
            100000
        );
    }


    async function setupSigners () {
        const accounts = await ethers.getSigners();
        creator = accounts[0];
        user = accounts[1];
        treasury = accounts[2];

    }
});
