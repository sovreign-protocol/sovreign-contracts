import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import * as helpers from './helpers/helpers';
import {diamondAsFacet} from "./helpers/diamond";
import { expect } from 'chai';
import * as deploy from './helpers/deploy';
import {BasketBalancer, ERC20Mock,ReignFacet, MulticallMock, SmartPoolMock, PoolRouter, WrapSVR } from '../typechain';
import { deployContract } from 'ethereum-waffle';

const address1 = '0x0000000000000000000000000000000000000001';
const address2 = '0x0000000000000000000000000000000000000002';
const address3 = '0x0000000000000000000000000000000000000003';

describe('BasketBalancer', function () {

    let reign: ReignFacet, reignToken:ERC20Mock, balancer: BasketBalancer, smartPool:SmartPoolMock;
    let router: PoolRouter, wrapper: WrapSVR;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;
    let reignDAO: Signer, treasury: Signer;
    let controller: Signer;

    let tokens = [address1,address2];

    let snapshotId: any;
    let snapshotTs: number;

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;


    var maxAllocation = BigNumber.from(10).mul(helpers.tenPow18).mul(2);

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

        wrapper = await deploy.deployContract('WrapSVR', []) as WrapSVR;
        reign = await diamondAsFacet(diamond, 'ReignFacet') as ReignFacet;
        smartPool = await deploy.deployContract('SmartPoolMock', [tokens[0], tokens[1]]) as SmartPoolMock;

        router = (await deploy.deployContract('PoolRouter', [
            smartPool.address,
            wrapper.address,
            await treasury.getAddress(),
            100000 //no fees for this test
        ])) as PoolRouter;


        await reign.initReign(reignToken.address, epochStart, epochDuration);


        await setupContracts();

        
    });

    beforeEach(async function () {
        balancer = (await deploy.deployContract(
            'BasketBalancer', 
            [
                reign.address,
                reignDAO.getAddress(), 
                router.address, 
                BigNumber.from(20).mul(BigNumber.from(10).pow(17)), 
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

        

        it('sets correct allocations during deployment', async function () {
            let alloc = await balancer.getTargetAllocation(tokens[0]);
            expect(alloc).to.equal(BigNumber.from(10).mul(helpers.tenPow18));
            alloc = await balancer.getTargetAllocation(tokens[1]);
            expect(alloc).to.equal(BigNumber.from(10).mul(helpers.tenPow18));
        });

        it('sets correct current vote during deployment', async function () {
            let alloc = await balancer.continuousVote(tokens[0]);
            expect(alloc).to.equal(BigNumber.from(10).mul(helpers.tenPow18));
            alloc = await balancer.continuousVote(tokens[1]);
            expect(alloc).to.equal(BigNumber.from(10).mul(helpers.tenPow18));
        });


        it('can vote with correct allocation', async function () {

            let epoch = await balancer.getCurrentEpoch();
            expect(await balancer.hasVotedInEpoch(userAddress,epoch)).to.be.false;

            await reign.connect(user).deposit(100);
            let newAlloc1 = maxAllocation.div(2).sub(1000000)
            let newAlloc2 = maxAllocation.div(2).add(1000000)
            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.not.be.reverted;

            expect(await balancer.hasVotedInEpoch(userAddress, epoch)).to.be.true;
        });

        it('can vote again after the epoch ends', async function () {
            await reign.connect(user).deposit(100);

            let newAlloc1 = maxAllocation.div(2).sub(1000000)
            let newAlloc2 = maxAllocation.div(2).add(1000000)

            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.not.be.reverted;

            await awaitUntilNextEpoch()
           
            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.not.be.reverted;

        });

        it('can not vote with too small allocation', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            let newAlloc1 = maxAllocation.div(2).sub(1000000)
            let newAlloc2 = maxAllocation.div(2)
            
            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('can not vote with too big allocation', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            let newAlloc1 = maxAllocation.div(2).add(1000000)
            let newAlloc2 = maxAllocation.div(2)

            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('can not vote with no stake', async function () {

            let newAlloc1 = maxAllocation.div(2).add(1000000)
            let newAlloc2 = maxAllocation.div(2).sub(1000000)


            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.be.revertedWith('Not allowed to vote')

        });

        it('can not vote with incorrectly ordered tokens', async function () {
            await reign.connect(user).deposit(100);

            let newAlloc1 = maxAllocation.div(2)
            let newAlloc2 = maxAllocation.div(2)

            await expect( 
                balancer.connect(user).updateAllocationVote([address2,address1], [newAlloc1,newAlloc2])
            ).to.be.revertedWith('tokens have incorrect order')

        });

        it('can not vote with incorrect number of tokens', async function () {
            await reign.connect(user).deposit(100);
            
            await expect( 
                balancer.connect(user).updateAllocationVote([address1], [maxAllocation])
            ).to.be.revertedWith('Need to vote for all tokens')

        });

        it('can not vote with incorrect number of allocation', async function () {
            await reign.connect(user).deposit(100);

            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [maxAllocation])
            ).to.be.revertedWith('Need to have same length')

        });

        it('can not vote twice in an epoch', async function () {
            await reign.connect(user).deposit(100);


            let newAlloc1 = maxAllocation.div(2)
            let newAlloc2 = maxAllocation.div(2)

            balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.be.revertedWith('Can not vote twice in an epoch')

        });

        it('updates continuous vote correctly', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await reign.connect(happyPirate).deposit(300);

            // voting power reflects after epoch is over
            await awaitUntilNextEpoch()
            await balancer.connect(reignDAO).updateBasketBalance();

            let newAlloc1 = maxAllocation.div(2).add(10000000000)
            let newAlloc2 = maxAllocation.div(2).sub(10000000000)
            await balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2]);

            // (previous * externVotingPower + new * votingPower)/totalVotingPower
            let expectedOutcome1 = (maxAllocation.div(2).mul(500).add((newAlloc1).mul(100))).div(600)
            let expectedOutcome2= (maxAllocation.div(2).mul(500).add((newAlloc2).mul(100))).div(600)
            expect(await balancer.continuousVote(tokens[0])).to.equal(BigNumber.from(expectedOutcome1));
            expect(await balancer.continuousVote(tokens[1])).to.equal(BigNumber.from(expectedOutcome2));

            newAlloc1 = maxAllocation.div(2).add(15000000000)
            newAlloc2 = maxAllocation.div(2).sub(15000000000)
            await balancer.connect(flyingParrot).updateAllocationVote(tokens, [newAlloc1,newAlloc2]);

            expectedOutcome1 = (expectedOutcome1.mul(400).add((newAlloc1).mul(200))).div(600)
            expectedOutcome2 = (expectedOutcome2.mul(400).add((newAlloc2).mul(200))).div(600)
            expect(await balancer.continuousVote(tokens[0])).to.equal(BigNumber.from(expectedOutcome1));
            expect(await balancer.continuousVote(tokens[1])).to.equal(BigNumber.from(expectedOutcome2));
        });
        

        it('sets correct basket balance ', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);
            await reign.connect(happyPirate).deposit(300);

            // voting power reflects after epoch is over
            await awaitUntilNextEpoch();
            await balancer.connect(reignDAO).updateBasketBalance();

            let newAlloc1 = maxAllocation.div(2).add(10000000000)
            let newAlloc2 = maxAllocation.div(2).sub(10000000000)
            await balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2]);

            
            await awaitUntilNextEpoch();
            await balancer.connect(reignDAO).updateBasketBalance();
            
            // New target is the average with the previous one  
            let expectedOutcome1 = (maxAllocation.div(2).mul(500).add((newAlloc1).mul(100))).div(600)
            let expectedOutcome2 = (maxAllocation.div(2).mul(500).add((newAlloc2).mul(100))).div(600)
            expect(await balancer.getTargetAllocation(tokens[0])).to.equal(
                BigNumber.from(expectedOutcome1).add(maxAllocation.div(2)).div(2)
            )
                    
            expect(await balancer.getTargetAllocation(tokens[1])).to.equal(
                BigNumber.from(expectedOutcome2).add(maxAllocation.div(2)).div(2)
            )

        });

        
        it('can not update twice in same epoch', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);


            await awaitUntilNextEpoch();
            await balancer.connect(reignDAO).updateBasketBalance();

            // this updates the balance
            let newAlloc1 = maxAllocation.div(2).add(10000000000)
            let newAlloc2 = maxAllocation.div(2).sub(10000000000)
            await balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2]);

            await expect(balancer.connect(reignDAO).updateBasketBalance()).to.be.revertedWith("Epoch is not over")

        });

        it('can not vote with too big delta', async function () {
            await reign.connect(user).deposit(100);
            await reign.connect(flyingParrot).deposit(200);

            
            let newAlloc1 = maxAllocation.div(2).add(maxAllocation.div(3))
            let newAlloc2 = maxAllocation.div(2).sub(maxAllocation.div(3))

            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc1,newAlloc2])
            ).to.be.revertedWith('Above Max Delta')

            await expect( 
                balancer.connect(user).updateAllocationVote(tokens, [newAlloc2,newAlloc1])
            ).to.be.revertedWith('Above Max Delta')

        });

        it('allows DAO to change max delta', async function () {
            await balancer.connect(reignDAO).setMaxDelta(400000000)
            expect( await balancer.maxDelta()).to.be.equal(400000000)
        });

        it('reverts if max delta is changed by someone else', async function () {
            await expect( 
                balancer.connect(flyingParrot).setMaxDelta(address3)
            ).to.be.revertedWith('Only the DAO can execute this')
        });


        it('allows DAO to add a new pool', async function () {
            await balancer.connect(reignDAO).addToken(address3, maxAllocation.div(10))
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(maxAllocation.div(10))
            expect( await balancer.full_allocation()).to.be.equal(maxAllocation.add(maxAllocation.div(10)))
            let tokens = await balancer.getTokens()
            expect(tokens[2]).to.be.equal(address3)
        });

        it('allows DAO to remove a new pool', async function () {
            await balancer.connect(reignDAO).addToken(address3, maxAllocation.div(10))
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(maxAllocation.div(10))
            expect( await balancer.full_allocation()).to.be.equal(maxAllocation.add(maxAllocation.div(10)))

            await balancer.connect(reignDAO).removeToken(address3)
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(0)
            expect( await balancer.full_allocation()).to.be.equal(maxAllocation)
            let tokens = await balancer.getTokens()
            expect(tokens.length).to.be.equal(2)
            expect(tokens[0]).to.be.equal(address1)
            expect(tokens[1]).to.be.equal(address2)
        });


        it('reverts if pool is added by someone else', async function () {
            await expect( 
                balancer.connect(flyingParrot).addToken(address3, maxAllocation.div(10))
            ).to.be.revertedWith('Only the DAO can execute this')

        });

        it('DAO can change router', async function () {
            await balancer.connect(reignDAO).setRouter(flyingParrotAddress)
            expect( await balancer.poolRouter()).to.be.equal(flyingParrotAddress)

        });

        it('router can not be changed by someone else', async function () {
            await expect( 
                balancer.connect(user).setRouter(flyingParrotAddress)
            ).to.be.revertedWith('Only the DAO can execute this')
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
