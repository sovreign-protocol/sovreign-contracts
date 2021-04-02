import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    Erc20Mock, BasketBalancerMock, PoolController, Pool
 } from '../typechain';
import * as deploy from './helpers/deploy';
import { stringify } from 'querystring';


describe('PoolController', function () {

    let  sov: Erc20Mock,reign: Erc20Mock, underlying1: Erc20Mock, underlying2: Erc20Mock
    let  balancer: BasketBalancerMock, pool_controller:PoolController;
    let pool:Pool;

    let user: Signer, userAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;

    let pool_address:string;

    before(async function () {
        sov = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        reign = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        underlying1 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        underlying2 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
 

        balancer = (await deploy.deployContract('BasketBalancerMock',[[underlying1.address], [1000000]])) as BasketBalancerMock; 

        await setupSigners();
        await setupContracts();



        
    });

    beforeEach(async function() {
        pool_controller = (
            await deploy.deployContract('PoolController', [balancer.address, sov.address, reign.address, reignDAOAddress])
        ) as PoolController; 

        await pool_controller.connect(reignDAO).createPool(underlying1.address)

        pool_address = await pool_controller.allPools(0);

        //connect to deployed pool
        pool = (await deploy.deployContract('Pool')) as Pool;
        pool = pool.attach(pool_address);
    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(pool_controller.address).to.not.eql(0).and.to.not.be.empty;
        });
    
    });
    
    
    describe('Creating Pools', async function () {

        
        it('creates a pool for an underlying', async function () {
            expect(await pool.token()).to.eq(underlying1.address)
        })


        it('adds the pools to the pool list', async function () {
            let pool_len = await pool_controller.allPoolsLength();
            expect(pool_len).to.eq(1);
            await expect(pool_controller.connect(reignDAO).createPool(underlying2.address)).to.not.be.reverted;
            let pool_len_after = await pool_controller.allPoolsLength();
            expect(pool_len_after).to.eq(2);
        });


        it('adds the pools to the balancer list', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(underlying2.address)).to.not.be.reverted;
            let all_pools = await balancer.getPools();
            expect(all_pools[0]).to.eq(await pool.token());
        });

        it('adds the pools to the mapping', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(underlying2.address)).to.not.be.reverted;
            let last_pool = await pool_controller.allPools(0);
            let new_pool = await pool_controller.getPool(underlying1.address);
            expect(new_pool).to.eq(last_pool);
            last_pool = await pool_controller.allPools(1);
            new_pool = await pool_controller.getPool(underlying2.address);
            expect(new_pool).to.eq(last_pool);
        });


        it('correctly relays taregt allocation', async function () {
            expect(await pool_controller.getTargetAllocation(underlying2.address)).to.eq(1000000);
        });

        it('correctly relays interest rate', async function () {
            let interest_rate = await pool_controller.getInterestRate(pool_address,100,101)
            expect(interest_rate[0]).to.eq(338497452615);
            expect(interest_rate[1]).to.eq(0);

            interest_rate = (await pool_controller.getInterestRate(pool_address,101,100))
            expect(interest_rate[0]).to.eq(57305936073);
            expect(interest_rate[1]).to.eq(0);
        });

        it('correctly returns on isPool', async function () {
            expect(await pool_controller.isPool(pool_address)).to.be.true;
            expect(await pool_controller.isPool(userAddress)).to.be.false;
        });

        it('initializes the interest strategy', async function () {
            let interest = await pool_controller.getInterestStrategy(pool_address);
            expect(interest).to.not.eql(0).and.to.not.be.empty;
        });

        it('reverts if unauthorized addresses creates pool', async function () {
            await expect( 
                 pool_controller.connect(user).createPool(helpers.zeroAddress)
            ).to.be.revertedWith('SoV-Reign: Forbidden');
        });

        it('reverts if underlying is zero', async function () {
            await expect( 
                 pool_controller.connect(reignDAO).createPool(helpers.zeroAddress)
            ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
        });

        it('reverts if pool already exists', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(underlying2.address)).to.not.be.reverted;
            await expect( 
                 pool_controller.connect(reignDAO).createPool(underlying2.address)
            ).to.be.revertedWith('SoV-Reign: POOL_EXISTS');
        });
    }); 


    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);

        await underlying1.mint(userAddress, cvValue);
        await underlying2.mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];

        userAddress = await user.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
    }

});