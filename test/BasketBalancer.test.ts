import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import * as helpers from './helpers/helpers';
import {diamondAsFacet} from "./helpers/diamond";
import { expect } from 'chai';
import * as deploy from './helpers/deploy';
import {BasketBalancer, ERC20Mock,ReignFacet, MulticallMock } from '../typechain';
import { deployContract } from 'ethereum-waffle';

const address1 = '0x0000000000000000000000000000000000000001';
const address2 = '0x0000000000000000000000000000000000000002';
const address3 = '0x0000000000000000000000000000000000000003';

describe('BasketBalancer', function () {

    let reign: ReignFacet, reignToken:ERC20Mock, balancer: BasketBalancer;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;
    let reignDAO: Signer, treasury: Signer;
    let controller: Signer;

    let pools = [address1,address2];

    let snapshotId: any;
    let snapshotTs: number;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;


    var maxAllocation = 1000000000;

    before(async function () {
        reignToken = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;

        await setupSigners();


        const cutFacet = await deploy.deployContract('DiamondCutFacet');
        const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
        const ownershipFacet = await deploy.deployContract('OwnershipFacet');
        const reignFacet = await deploy.deployContract('ReignFacet');
        const epochClockFacet = await deploy.deployContract('EpochClockFacet');
        const diamond = await deploy.deployDiamond(
            'ReignDiamond',
            [cutFacet, loupeFacet, ownershipFacet, reignFacet,epochClockFacet],
            userAddress,
        );

        reign = (await diamondAsFacet(diamond, 'ReignFacet')) as ReignFacet;
        await reign.initReign(reignToken.address, epochStart, epochDuration);


        await setupContracts();

        
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
            ])
            ) as BasketBalancer;


        snapshotId = await ethers.provider.send('evm_snapshot', []);
        snapshotTs = await helpers.getLatestBlockTimestamp();
    });

    afterEach(async function () {
        await helpers.setAutomine(true)
        await ethers.provider.send('evm_revert', [snapshotId]);
        await helpers.moveAtTimestamp(snapshotTs + 5);
    });

    describe('General', function () {
        it('should be deployed', async function () {
            expect(balancer.address).to.not.eql(0).and.to.not.be.empty;
        });

        it('keeps correct epoch', async function () {
            expect(await balancer.getCurrentEpoch()).to.eq(0);
            awaitUntilNextEpoch()
            expect(await balancer.getCurrentEpoch()).to.eq(1);
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
                    maxAllocation/10
            ])
                ) as BasketBalancer;
            expect(balancerEmpty.address).to.not.eql(0).and.to.not.be.empty;
        });

        it('can not deployed with incompatible length arrays', async function () {
            await expect( deploy.deployContract(
                'BasketBalancer', 
                [
                    pools,
                    [500000000],
                    reign.address,
                    reignDAO.getAddress(), 
                    controller.getAddress(), 
                    maxAllocation/10
            ])).to.be.revertedWith("Need to have same length");
        });

        it('can not deployed with incorrect Allocation', async function () {
            await expect( deploy.deployContract(
                'BasketBalancer', 
                [
                    pools,
                    [700000000,500000000],
                    reign.address,
                    reignDAO.getAddress(), 
                    controller.getAddress(), 
                    maxAllocation/10
            ])).to.be.revertedWith("Allocation is not complete");
        });

        it('sets correct allocations during deployment with arrays', async function () {
            let alloc = await balancer.getTargetAllocation(pools[0]);
            expect(alloc).to.equal(500000000);
            alloc = await balancer.getTargetAllocation(pools[1]);
            expect(alloc).to.equal(500000000);
        });

        it('sets correct current vote during deployment with arrays', async function () {
            let alloc = await balancer.continuousVote(pools[0]);
            expect(alloc).to.equal(500000000);
            alloc = await balancer.continuousVote(pools[1]);
            expect(alloc).to.equal(500000000);
        });

        it('sets correct allocation and current during initialization', async function () {

            await expect(
                balancer.connect(flyingParrot).setInitialAllocation([450000000,550000000])
            ).to.be.revertedWith("Only the DAO can execute this")

            await balancer.connect(reignDAO).setInitialAllocation([450000000,550000000]);
            
            let alloc = await balancer.continuousVote(pools[0]);
            expect(alloc).to.equal(450000000);
            alloc = await balancer.continuousVote(pools[1]);
            expect(alloc).to.equal(550000000);

            await expect(balancer.connect(reignDAO).setInitialAllocation([450000000,550000000])).to.be.revertedWith("Already Initialized")
        });

        it('can vote with correct allocation', async function () {

            let epoch = await balancer.getCurrentEpoch();
            expect(await balancer.hasVotedInEpoch(userAddress,epoch)).to.be.false;

            await reign.connect(user).deposit(100);
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [450000000,550000000])
            ).to.not.be.reverted;

            expect(await balancer.hasVotedInEpoch(userAddress, epoch)).to.be.true;
        });

        it('can vote again after the epoch ends', async function () {
            await reign.connect(user).deposit(100);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [450000000,550000000])
            ).to.not.be.reverted;

            await awaitUntilNextEpoch()
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [450000000,550000000])
            ).to.not.be.reverted;

        });

        it('can not vote with too small allocation', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [450000000,500000000])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('can not vote with too big allocation', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [600000000,500000000])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('can not vote with no stake', async function () {
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [500000000,500000000])
            ).to.be.revertedWith('Not allowed to vote')

        });

        it('can not vote with incorrectly ordered pools', async function () {
            await reign.connect(user).deposit(100);

            await expect( 
                balancer.connect(user).updateAllocationVote([address2,address1], [500000000,500000000])
            ).to.be.revertedWith('Pools have incorrect order')

        });

        it('can not vote with incorrect number of pools', async function () {
            await reign.connect(user).deposit(100);
            
            await expect( 
                balancer.connect(user).updateAllocationVote([address1], [500000000])
            ).to.be.revertedWith('Need to vote for all pools')

        });

        it('can not vote with incorrect number of allocation', async function () {
            await reign.connect(user).deposit(100);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [500000000])
            ).to.be.revertedWith('Need to have same length')

        });

        it('can not vote twice in an epoch', async function () {
            await reign.connect(user).deposit(100);

            balancer.connect(user).updateAllocationVote(pools, [500000000,500000000])
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [500000000,500000000])
            ).to.be.revertedWith('Can not vote twice in an epoch')

        });

        it('reverts if update is called in same block as a deposit happened', async function () {
            let multicall = await deploy.deployContract(
                'MulticallMock', [reign.address, reignToken.address, balancer.address]
            ) as MulticallMock;

            
            awaitUntilNextEpoch()


            await reignToken.mint(multicall.address, 1000)
            await expect( 
                multicall.falshloanTest(3)
            ).to.be.revertedWith('Can not end epoch if deposited in same block') 
        })

        it('updates continuous vote correctly', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await reign.connect(happyPirate).deposit(300);

            // voting power reflects after epoch is over
            await awaitUntilNextEpoch()
            await balancer.updateBasketBalance();


            await balancer.connect(user).updateAllocationVote(pools, [480000000,520000000]);

            // (480000000 * 100 + 500000000 * 500)/600 = 496666666
            // (520000000 * 100 + 500000000 * 500)/600 = 503333333
            expect(await balancer.continuousVote(pools[0])).to.equal(BigNumber.from(496666666));
            expect(await balancer.continuousVote(pools[1])).to.equal(BigNumber.from(503333333));

            
            await balancer.connect(flyingParrot).updateAllocationVote(pools, [450000000,550000000]);

            // (450000000 * 200 + 496666666 * 400)/600 = 481111110
            // (550000000 * 200 + 503333333 * 400)/600 = 518888888
            expect(await balancer.continuousVote(pools[0])).to.equal(BigNumber.from(481111110));
            expect(await balancer.continuousVote(pools[1])).to.equal(BigNumber.from(518888888));
        });
        

        it('sets correct basket balance after update period', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await reign.connect(happyPirate).deposit(300);

            // voting power reflects after epoch is over
            await awaitUntilNextEpoch();
            await balancer.updateBasketBalance();

            await balancer.connect(user).updateAllocationVote(pools, [480000000,520000000]);
            await balancer.connect(flyingParrot).updateAllocationVote(pools, [450000000,550000000]);

            
            await awaitUntilNextEpoch();
            await balancer.updateBasketBalance();
            await awaitUpdatePeriod();
            
            // New target is the average with the previous one  
            // (481111110 + 500000000 ) / 2 = 490555555
            // (518888888 + 500000000 ) / 2 = 509444444
            expect(await balancer.getTargetAllocation(pools[0])).to.equal(BigNumber.from(490555555));
            expect(await balancer.getTargetAllocation(pools[1])).to.equal(BigNumber.from(509444444));

        });

        it('sets correct basket balance during update period', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await reign.connect(happyPirate).deposit(300);


            // voting power reflects after epoch is over
            await awaitUntilNextEpoch();
            await balancer.getCurrentEpoch()
            await balancer.updateBasketBalance();

            await balancer.connect(user).updateAllocationVote(pools, [480000000,520000000]);
            await balancer.connect(flyingParrot).updateAllocationVote(pools, [450000000,550000000])      
            await awaitUntilNextEpoch();
            await balancer.getCurrentEpoch()
            await balancer.updateBasketBalance();

            //let half of the period elapse, allocation should be half-way updated
            await helpers.moveAtTimestamp((await balancer.lastEpochEnd()).toNumber() + (172800/2))

            // Half way during update period 
            // 500000000 - (500000000 - 490555555) / 2 = 495277778
            // 500000000 + (509444444 - 500000000) / 2 = 504722222
            //this sometimes fails if there is a 1 block discrepancy, due to 'moveAtTimestamp' mining
            expect(await balancer.getTargetAllocation(pools[0])).to.equal(BigNumber.from(495277778)); 
            expect(await balancer.getTargetAllocation(pools[1])).to.equal(BigNumber.from(504722222));

        });

        
        it('can not update twice in same epoch', async function () {
            awaitUntilNextEpoch()

            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            // this updates the balance
            await balancer.connect(user).updateAllocationVote(pools, [450000000,550000000]);

            await expect(balancer.updateBasketBalance()).to.be.revertedWith("Epoch is not over")

        });

        it('can not vote with too big delta', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

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
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [650000000,350000000])
            ).to.not.be.reverted;
        });

        it('reverts if max delta is changed by someone else', async function () {
            await expect( 
                balancer.connect(flyingParrot).setMaxDelta(address3)
            ).to.be.revertedWith('Only the DAO can execute this')
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
            ).to.be.revertedWith('Only the DAO can execute this')
        });

    });

    async function awaitUpdatePeriod() {
        //wait until the update periods is over
        await helpers.moveAtTimestamp(
             await helpers.getLatestBlockTimestamp() + 172800 + 1000
            )
    }

    async function awaitUntilNextEpoch() {
        //wait until the update periods is over
        helpers.moveAtEpoch(epochStart, epochDuration, ( await balancer.getCurrentEpoch()).add(1).toNumber())
        await balancer.getCurrentEpoch()
    }

    async function setupContracts () {
        reignToken.mint(userAddress, BigNumber.from(9309393));
        reignToken.connect(user).approve(reign.address, BigNumber.from(9309393));
        reignToken.mint(flyingParrotAddress, BigNumber.from(9309393));
        reignToken.connect(flyingParrot).approve(reign.address, BigNumber.from(9309393));
        reignToken.mint(happyPirateAddress, BigNumber.from(9309393));
        reignToken.connect(happyPirate).approve(reign.address, BigNumber.from(9309393));
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
