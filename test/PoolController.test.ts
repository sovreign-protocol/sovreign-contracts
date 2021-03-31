import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';
import { 
    Erc20Mock, BasketBalancerMock, PoolController
 } from '../typechain';
import * as deploy from './helpers/deploy';


describe('PoolController', function () {

    let  sov: Erc20Mock,reign: Erc20Mock, underlying: Erc20Mock
    let  balancer: BasketBalancerMock, pool_controller:PoolController;

    let user: Signer, userAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;

    before(async function () {
        sov = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        reign = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        underlying = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 

        balancer = (await deploy.deployContract('BasketBalancerMock',[[], []])) as BasketBalancerMock; 

        await setupSigners();
        await setupContracts();

        
    });

    beforeEach(async function() {
        pool_controller = (
            await deploy.deployContract('PoolController', [balancer.address, sov.address, reign.address, reignDAOAddress])
        ) as PoolController; 
    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(pool_controller.address).to.not.eql(0).and.to.not.be.empty;
        });
    
    }); 
    
    describe('Creating Pools', async function () {

        it('creates a pool for an underlying', async function () {
            let pool_address = await pool_controller.connect(reignDAO).createPool(underlying.address);
            expect(pool_address).to.not.eql(0).and.to.not.be.empty;
        });


        it('adds the pools to the pool list', async function () {
            let pool_len = await pool_controller.allPoolsLength();
            expect(pool_len).to.eq(0);
            await expect(pool_controller.connect(reignDAO).createPool(underlying.address)).to.not.be.reverted;
            let pool_len_after = await pool_controller.allPoolsLength();
            expect(pool_len_after).to.eq(1);
        });

        it('adds the pool to the mapping', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(underlying.address)).to.not.be.reverted;
            let last_pool = await pool_controller.allPools(0);
            let new_pool = await pool_controller.getPool(underlying.address);
            expect(new_pool).to.eq(last_pool);
        });

        it('initializes the interest strategy', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(underlying.address)).to.not.be.reverted;
            let last_pool = await pool_controller.allPools(0);
            let interest = await pool_controller.getInterestStrategy(last_pool);
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
            await expect(pool_controller.connect(reignDAO).createPool(underlying.address)).to.not.be.reverted;
            await expect( 
                 pool_controller.connect(reignDAO).createPool(underlying.address)
            ).to.be.revertedWith('SoV-Reign: POOL_EXISTS');
        });
    }); 


    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);

        await underlying.mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];

        userAddress = await user.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
    }

});