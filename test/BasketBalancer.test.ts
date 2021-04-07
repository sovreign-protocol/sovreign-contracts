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

    let reign: ReignMock, bond: Erc20Mock, rewards: Rewards, balancer: BasketBalancer;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let flyingParrot: Signer, flyingParrotAddress: string;
    let communityVault: Signer, treasury: Signer;

    let pools = [address1,address2];

    let snapshotId: any;
    let snapshotTs: number;

    before(async function () {
        bond = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;

        await setupSigners();
        await setupContracts();

        reign = (await deploy.deployContract('ReignMock')) as ReignMock;

        rewards = (await deploy.deployContract(
            'Rewards',
            [await treasury.getAddress(), bond.address, reign.address])
        ) as Rewards;

        var allocation = [500000,500000]
        balancer = (await deploy.deployContract(
            'BasketBalancer', 
            [pools,allocation,reign.address,flyingParrotAddress])
            ) as BasketBalancer;

        await reign.setRewards(rewards.address);
    });

    beforeEach(async function () {
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

        it('sets correct allocations', async function () {
            let alloc = await balancer.getTargetAllocation(pools[0]);
            expect(alloc).to.equal(500000);
            alloc = await balancer.getTargetAllocation(pools[1]);
            expect(alloc).to.equal(500000);
        });

        it('inition allocation vote is empty ', async function () {
            let alloc = await balancer.connect(user).getAllocationVote(userAddress);
            expect(alloc[0].length).to.equal(0);
            expect(alloc[1].length).to.equal(0);
            expect(alloc[2]).to.equal(0);
        });

        it('can vote with correct allocation', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await balancer.connect(user).updateAllocationVote(pools, [200000,800000]);

            let resp = await balancer.connect(user).getAllocationVote(userAddress);
            expect(resp[0][0]).to.equal(pools[0]);
            expect(resp[1][0]).to.equal(200000);
            expect(resp[2]).to.gt(0);

            // (500000 * 200 + 200000 * 100) / 300 = 400000
            // (500000 * 200 + 800000 * 100) / 300 = 600000
            let alloc = await balancer.computeAllocation();
            expect(alloc[0]).to.equal(BigNumber.from(400000));

        });

        it('can not vote wth insufficient allocation', async function () {
            await reign.deposit(userAddress, 100);
            await reign.deposit(flyingParrotAddress, 200);

            await expect( 
                balancer.connect(user).updateAllocationVote(pools, [BigNumber.from(100000),BigNumber.from(700000)])
            ).to.be.revertedWith('Allocation is not complete')

        });

        it('user can not add a new pool', async function () {
            await expect( 
                balancer.connect(user).addPool(address3)
            ).to.be.revertedWith('Only the DAO can edit this')

        });

        it('DAO can add a new pool', async function () {
            await balancer.connect(flyingParrot).addPool(address3)
            expect( await balancer.getTargetAllocation(address3)).to.be.equal(0)
            let pools = await balancer.getPools()
            expect(pools[2]).to.be.equal(address3)
        });

    });

    

    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);
        const treasuryValue = BigNumber.from(4500000).mul(helpers.tenPow18);

        await bond.mint(await communityVault.getAddress(), cvValue);
        await bond.mint(await treasury.getAddress(), treasuryValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        communityVault = accounts[1];
        treasury = accounts[2];
        happyPirate = accounts[3];
        flyingParrot = accounts[4];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
        flyingParrotAddress = await flyingParrot.getAddress();
    }
});
