import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import * as helpers from './helpers/helpers';
import * as time from './helpers/time';
import { expect } from 'chai';
import { ReignMock, Erc20Mock, Rewards, BasketBalancer } from '../typechain';
import * as deploy from './helpers/deploy';

const address1 = '0x0000000000000000000000000000000000000001';
const address2 = '0x0000000000000000000000000000000000000002';
const address3 = '0x0000000000000000000000000000000000000003';

describe('BasketBalancer', function () {

    let reign: ReignMock,reignToken:Erc20Mock, rewards: Rewards, balancer: BasketBalancer;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;
    let reignDAO: Signer, treasury: Signer;
    let controller: Signer;

    let pools = [address1,address2];

    let snapshotId: any;
    let snapshotTs: number;

    var maxAllocation = 1000000000;

    before(async function () {
        reignToken = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;

        await setupSigners();
        await setupContracts();

        reign = (await deploy.deployContract('ReignMock')) as ReignMock;

        rewards = (await deploy.deployContract(
            'Rewards',
            [await treasury.getAddress(), reign.address, reign.address])
        ) as Rewards;

       
        await reign.setRewards(rewards.address);
    });

    beforeEach(async function () {
        var allocation = [maxAllocation/2,maxAllocation/2]
        balancer = (await deploy.deployContract(
            'BasketBalancer', 
            [
                pools,
                allocation,
                reign.address,
                reignDAO.getAddress(), 
                controller.getAddress(), 
                maxAllocation/10, 
                helpers.stakingEpochStart
            ])
            ) as BasketBalancer;


        snapshotId = await ethers.provider.send('evm_snapshot', []);
        snapshotTs = await helpers.getLatestBlockTimestamp();
    });

    afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId]);

        await helpers.moveAtTimestamp(snapshotTs + 5);
    });

    describe('General', function () {
        it('should be deployed', async function () {
            expect(balancer.address).to.not.eql(0).and.to.not.be.empty;
        });

        it('keeps correct epoch', async function () {
            expect(await balancer.getCurrentEpoch()).to.eq(await helpers.getCurrentEpoch());
        });

        it('can be deployed with empty arrays', async function () {
            let balancerEmpty = (await deploy.deployContract(
                'BasketBalancer', 
                [
                    [],
                    [],
                    reign.address,
                    reignDAO.getAddress(), 
                    controller.getAddress(), 
                    maxAllocation/10, 
                    await helpers.getLatestBlockTimestamp()+10000
            ])
                ) as BasketBalancer;
            expect(balancerEmpty.address).to.not.eql(0).and.to.not.be.empty;
            expect(await balancerEmpty.getCurrentEpoch()).to.be.eq(0);
        });

        it('sets correct allocations', async function () {
            await awaitUpdatePeriod();
            let alloc = await balancer.getTargetAllocation(pools[0]);
            expect(alloc).to.equal(500000000);
            alloc = await balancer.getTargetAllocation(pools[1]);
            expect(alloc).to.equal(500000000);
        });

        it('initial allocation vote is empty ', async function () {
            let alloc = await balancer.connect(user).getAllocationVote(userAddress);
            expect(alloc[0].length).to.equal(0);
            expect(alloc[1].length).to.equal(0);
            expect(alloc[2]).to.equal(0);
        });

        it('can vote with correct allocation', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);

            let resp = await balancer.connect(user).getAllocationVote(userAddress);
            expect(resp[0][0]).to.equal(pools[0]);
            expect(resp[1][0]).to.equal(450000000);
            expect(resp[1][1]).to.equal(550000000);
            expect(resp[2]).to.gt(0);
        });

        it('can not vote with too small allocation', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [450000000,500000000])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('can not vote with too big allocation', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [600000000,500000000])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('computes allocation correctly', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);

            let resp = await balancer.connect(user).getAllocationVote(userAddress);

            // (500000000 * 200 + 450000000 * 100) / 300 = 483333334
            // (500000000 * 200 + 550000000 * 100) / 300 = 526666666
            let alloc = await balancer.computeAllocation();
            expect(alloc[0]).to.equal(BigNumber.from(483333334));
            expect(alloc[1]).to.equal(BigNumber.from(516666666));

        });

        it('sets correct basket balance during update period', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);

            // (500000000 * 200 + 450000000 * 100) / 300 = 483333334
            // (500000000 * 200 + 550000000 * 100) / 300 = 526666666
            await balancer.updateBasketBalance();
            //let half of the period elapse, allocation should be half-way updated
            await helpers.moveAtTimestamp(
            (await balancer.lastEpochEnd()).toNumber() + (172800/2)
               )
            // 500000000 + (500000000 - 483333334) / 2 = 491666667
            // 500000000 + (516666666 - 500000000) / 2 = 508333333
            expect(await balancer.getTargetAllocation(pools[0])).to.equal(BigNumber.from(491666667));
            expect(await balancer.getTargetAllocation(pools[1])).to.equal(BigNumber.from(508333333));

        });

        it('sets correct basket balance after update period', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);

            // (500000000 * 200 + 450000000 * 100) / 300 = 483333334
            // (500000000 * 200 + 550000000 * 100) / 300 = 526666666
            await balancer.updateBasketBalance();
            await awaitUpdatePeriod();
            expect(await balancer.getTargetAllocation(pools[0])).to.equal(BigNumber.from(483333334));
            expect(await balancer.getTargetAllocation(pools[1])).to.equal(BigNumber.from(516666666));

        });

        it('can not update twice in same epoch', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);
            await balancer.updateBasketBalance();

            await expect(balancer.updateBasketBalance()).to.be.revertedWith("Epoch is not over")

        });

        it('can not vote with too big delta', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [350000000,650000000])
            ).to.be.revertedWith('Above Max Delta')

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [650000000,350000000])
            ).to.be.revertedWith('Above Max Delta')

        });

        it('allows DAO to change max delta', async function () {
            await balancer.connect(reignDAO).setMaxDelta(400000000)
            expect( await balancer.maxDelta()).to.be.equal(400000000)

            // now the previous vote passes
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [650000000,350000000])
            ).to.not.be.reverted;
        });

        it('reverts if max delta is changed by someone else', async function () {
            await expect( 
                balancer.connect(flyingParrot).setMaxDelta(address3)
            ).to.be.revertedWith('Only the Controller can execute this')
        });


        it('allows controller to add a new pool', async function () {
            await balancer.connect(controller).addPool(address3)
            await awaitUpdatePeriod();
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(0)
            let pools = await balancer.getPools()
            expect(pools[2]).to.be.equal(address3)
        });


        it('reverts if pool is added by someone else', async function () {
            await expect( 
                balancer.connect(flyingParrot).addPool(address3)
            ).to.be.revertedWith('Only the Controller can execute this')

        });

        it('controller can change controller', async function () {
            await balancer.connect(controller).setController(flyingParrotAddress)
            expect( await balancer.controller()).to.be.equal(flyingParrotAddress)

            //flaying parrot can now add pools
            await balancer.connect(flyingParrot).addPool(address3)
            await awaitUpdatePeriod();
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(0)
            let pools = await balancer.getPools()
            expect(pools[2]).to.be.equal(address3)
        });

        it('controller can not be changed by someone else', async function () {
            await expect( 
                balancer.connect(user).setController(flyingParrotAddress)
            ).to.be.revertedWith('Only the Controller can execute this')
        });

        it('DAO can change DAO', async function () {
            await balancer.connect(reignDAO).setReignDAO(flyingParrotAddress)
            expect( await balancer.reignDAO()).to.be.equal(flyingParrotAddress)
        });

        it('reignDAO can not be changed by someone else', async function () {
            await expect( 
                balancer.connect(user).setReignDAO(flyingParrotAddress)
            ).to.be.revertedWith('Only the Controller can execute this')
        });

    });

    async function awaitUpdatePeriod() {
        //wait until the update perios is over
        await helpers.moveAtTimestamp(
             await helpers.getLatestBlockTimestamp() + 172800 + 1000
            )
    }

    async function setupContracts () {
        reignToken.mint(userAddress, BigNumber.from(9309393));
        reignToken.mint(flyingParrotAddress, BigNumber.from(9309393));
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];
        treasury = accounts[2];
        happyPirate = accounts[3];
        flyingParrot = accounts[4];
        controller = accounts[5];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
        flyingParrotAddress = await flyingParrot.getAddress();
    }
});
