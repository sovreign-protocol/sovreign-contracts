import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { moveAtEpoch, tenPow18,mineBlocks,setNextBlockTimestamp,getCurrentUnix, moveAtTimestamp } from "./helpers/helpers";
import { deployContract } from "./helpers/deploy";
import { expect } from "chai";
import { RewardsVault, Erc20Mock, Staking, PoolRewards, PoolControllerMock,LiquidityBufferVault, InterestStrategy, BasketBalancerMock } from "../typechain";

describe("YieldFarm REIGN Pool", function () {
    let staking: Staking;
    let reignToken: Erc20Mock;
    let svrToken: Erc20Mock;
    let poolLP: Erc20Mock;
    let yieldFarm: PoolRewards;
    let interest: InterestStrategy;
    let controller: PoolControllerMock;
    let rewardsVault: RewardsVault;
    let liquidityBuffer:LiquidityBufferVault;
    let creator: Signer, user: Signer;
    let reignDAO: Signer, treasury: Signer;
    let userAddr: string;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;
    const numberOfEpochs = 100;

    const distributedAmount: BigNumber = BigNumber.from(50000000).mul(tenPow18);
    const baseAdjustment: BigNumber = BigNumber.from(1).mul(tenPow18);
    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;

    let snapshotId: any;

    before(async function () {
        await setupSigners()
        userAddr = await user.getAddress();

        reignToken = (await deployContract("ERC20Mock")) as Erc20Mock;
        svrToken = (await deployContract("ERC20Mock")) as Erc20Mock;
        poolLP = (await deployContract("ERC20Mock")) as Erc20Mock;

        let balancer = (await deployContract("BasketBalancerMock",[[],[]])) as BasketBalancerMock;

        let multiplier = BigNumber.from(3).mul(10**10);
        let offset = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));
        let baseDelta = 0;
        interest = (await deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta, reignDAO.getAddress(), epochStart])
            ) as InterestStrategy;;

        controller = (await deployContract("PoolControllerMock",[interest.address,baseAdjustment, balancer.address ])) as PoolControllerMock;

        staking = (await deployContract("Staking", [epochStart])) as Staking;

        rewardsVault = (await deployContract("RewardsVault", [reignToken.address])) as RewardsVault;
        liquidityBuffer = (await deployContract("LiquidityBufferVault", [reignToken.address])) as LiquidityBufferVault;
        yieldFarm = (await deployContract("PoolRewards", [
            reignToken.address,
            poolLP.address,
            controller.address,
            staking.address,
            rewardsVault.address,
            liquidityBuffer.address
        ])) as PoolRewards;

        await reignToken.mint(rewardsVault.address, distributedAmount);
        await rewardsVault.connect(creator).setAllowance(yieldFarm.address, distributedAmount);

        await reignToken.mint(liquidityBuffer.address, distributedAmount);
        await rewardsVault.connect(creator).setAllowance(liquidityBuffer.address, distributedAmount);


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
            expect(staking.address).to.not.equal(0)
            expect(yieldFarm.address).to.not.equal(0)
            expect(reignToken.address).to.not.equal(0)
        })

        it('Get epoch PoolSize and distribute tokens', async function () {
            await depositPoolLP(amount)

            await interest.accrueInterest(10000,10000);


            await moveAtEpoch(epochStart, epochDuration, 1)
            await accrueAndMoveToEpoch(2)
            await moveAtEpoch(epochStart, epochDuration, 3)
            const totalAmount = amount

            expect(await yieldFarm.getPoolSize(1)).to.equal(totalAmount)
            expect(await yieldFarm.getEpochStake(userAddr, 1)).to.equal(totalAmount)
            expect(
                await reignToken.allowance(rewardsVault.address, yieldFarm.address)
            ).to.equal(distributedAmount)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(2) // epoch on yield is staking - 1

            
            // get epoch 1 rewards
            let epoch1Rewards = (await yieldFarm.getRewardsForEpoch(1, poolLP.address))[0];

            let boostMultiplier = await yieldFarm.getBoost(userAddr, 1);
            
            // as the user didn't vote this epoch (see balancerMock) we need to apply Boost
            let distributedRewards = (epoch1Rewards).mul(boostMultiplier).div(tenPow18);

            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(userAddr)).to.eq(distributedRewards)
        })
    })

    describe('Harvesting Tests', function () {
        it('User harvest and mass Harvest', async function () {
            await depositPoolLP(amount)
            const totalAmount = amount
            // initialize epochs meanwhile
            await accrueAndMoveToEpoch(1)
            await accrueAndMoveToEpoch(2)
            await accrueAndMoveToEpoch(3)
            await accrueAndMoveToEpoch(4)
            await accrueAndMoveToEpoch(5)
            await accrueAndMoveToEpoch(6)
            await accrueAndMoveToEpoch(7)
            await accrueAndMoveToEpoch(8)
            await accrueAndMoveToEpoch(9)
            expect(await yieldFarm.getPoolSize(1)).to.equal(amount)

            expect(await yieldFarm.lastInitializedEpoch()).to.equal(0) // no epoch initialized
            await expect(yieldFarm.harvest(10)).to.be.revertedWith('This epoch is in the future')
            await expect(yieldFarm.harvest(3)).to.be.revertedWith('Harvest in order')
            await yieldFarm.connect(user).harvest(1)
            let epoch1Rewards = 
                (await yieldFarm.getRewardsForEpoch(1, poolLP.address))[0]

            let boostMultiplier = await yieldFarm.getBoost(userAddr, 1);
            
            // as the user didn't vote this epoch (see balancerMock) we need to apply Boost
            let distributedRewards = (epoch1Rewards).mul(boostMultiplier).div(tenPow18);
            expect(await reignToken.balanceOf(userAddr)).to.equal(
                distributedRewards
            )
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(1)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(1) // epoch 1 have been initialized

            await (await yieldFarm.connect(user).massHarvest()).wait()
            const totalDistributedAmount = await totalAccruedUntilEpoch(8)
            expect(await reignToken.balanceOf(userAddr)).to.equal(totalDistributedAmount)
            expect(await yieldFarm.connect(user).userLastEpochIdHarvested()).to.equal(7)
            expect(await yieldFarm.lastInitializedEpoch()).to.equal(7) // epoch 7 has been initialized
        })
        it('harvests 0 if there is nothing to harvest', async function () {
            await depositPoolLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 30)
            expect(await yieldFarm.getPoolSize(1)).to.equal(amount)
            await yieldFarm.connect(creator).harvest(1)
            expect(await reignToken.balanceOf(await creator.getAddress())).to.equal(0)
            await yieldFarm.connect(creator).massHarvest()
            expect(await reignToken.balanceOf(await creator.getAddress())).to.equal(0)
        })
        it('nothing to harvest if interest is negative', async function () {
            await mineBlocks(1000); 
            await interest.accrueInterest(10000,11000);
            await moveAtEpoch(epochStart, epochDuration, 1)
            await mineBlocks(1000); 
            await interest.accrueInterest(10000,11000);
            await moveAtEpoch(epochStart, epochDuration, 3)
            await yieldFarm.connect(creator).harvest(1)
            expect(await reignToken.balanceOf(await creator.getAddress())).to.equal(0)
        })

        it('difference is sent to Liquidity Buffer', async function () {
            await mineBlocks(1000); 
            await interest.accrueInterest(10000,11000);
            await moveAtEpoch(epochStart, epochDuration, 1)
            await mineBlocks(1000); 
            await interest.accrueInterest(10000,11000);
            await moveAtEpoch(epochStart, epochDuration, 3)
            await yieldFarm.connect(creator).harvest(1)
        })
        it('gives epochid = 0 for previous epochs', async function () {
            await moveAtTimestamp(epochStart)
            await moveAtEpoch(epochStart, epochDuration, -2)
            expect(await yieldFarm.getCurrentEpoch()).to.equal(0)
        })
        it('it should return 0 if no deposit in an epoch', async function () {
            await moveAtTimestamp(epochStart)
            await moveAtEpoch(epochStart, epochDuration, 3)
            await yieldFarm.connect(user).harvest(1)
            expect(await reignToken.balanceOf(await user.getAddress())).to.equal(0)
        })
    })

    describe('Events', function () {
        it('Harvest emits Harvest', async function () {
            await depositPoolLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).harvest(1))
                .to.emit(yieldFarm, 'Harvest')
        })

        it('MassHarvest emits MassHarvest', async function () {
            await depositPoolLP(amount)
            await moveAtEpoch(epochStart, epochDuration, 9)

            await expect(yieldFarm.connect(user).massHarvest())
                .to.emit(yieldFarm, 'MassHarvest')
        })
    })

    async function accrueAndMoveToEpoch(n:number) {
        await mineBlocks(1000); 
        await interest.accrueInterest(10000,10000);
        await moveAtEpoch(epochStart, epochDuration, n)
        
    }

    async function totalAccruedUntilEpoch(n:number) {
        let total = BigNumber.from(0);
        for(let i = 0; i < n; i++){
            let epochBoost = await yieldFarm.getBoost(userAddr, i);
            let adjusted = epochBoost.mul((await yieldFarm.getRewardsForEpoch(i, poolLP.address))[0]).div(tenPow18)
            total = total.add(adjusted);
        }
        return total
    }

    async function depositPoolLP(x: BigNumber, u = user) {
        const ua = await u.getAddress();
        await poolLP.mint(ua, x);
        await poolLP.connect(u).approve(staking.address, x);
        return await staking.connect(u).deposit(poolLP.address, x);
    }


    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[3];
        treasury = accounts[1];
        reignDAO = accounts[2];
        creator = accounts[0];

    }
});
