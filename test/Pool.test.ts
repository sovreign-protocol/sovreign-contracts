import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    Erc20Mock, BasketBalancerMock, PoolController, Pool, SovToken, ReignToken, OracleMock, InterestStrategy
 } from '../typechain';
import * as deploy from './helpers/deploy';


describe('Pool', function () {

    let  sov: SovToken, reign: ReignToken, underlying1: Erc20Mock
    let  balancer: BasketBalancerMock, pool_controller:PoolController;
    let  oracle:OracleMock, intrestStaretgy: InterestStrategy;
    let  pool:Pool;

    let user: Signer, userAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let newAddress:string;

    let pool_address:string;

    before(async function () {

        await setupSigners();

        
        underlying1 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        
        oracle = (await deploy.deployContract('OracleMock')) as OracleMock;
        intrestStaretgy = (await deploy.deployContract('InterestStrategy')) as InterestStrategy;
 

        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[underlying1.address], [1000000]])
        ) as BasketBalancerMock;
        

        await setupContracts();
   
    });

    beforeEach(async function() {

        sov = (await deploy.deployContract('SovToken', [userAddress])) as SovToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;

        pool_controller = (
            await deploy.deployContract('PoolController', [balancer.address, sov.address, reign.address, reignDAOAddress])
        ) as PoolController; 

        await pool_controller.connect(reignDAO).createPool(
            underlying1.address, intrestStaretgy.address, oracle.address
        )

        pool_address = await pool_controller.allPools(0);

        //connect to deployed pool
        pool = (await deploy.deployContract('Pool')) as Pool;
        pool = pool.attach(pool_address);

        sov.connect(user).setController(pool_controller.address)
        reign.connect(user).setController(pool_controller.address)

        await setupContracts()
        

    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(pool_controller.address).to.not.eql(0).and.to.not.be.empty;
            expect(pool.address).to.not.eql(0).and.to.not.be.empty;
        });
    
    });



    describe('Getters and Setters', async function () {

        it('returns correct Factory address', async function () {
            expect(
                await pool.controllerAddress()
            ).to.eq(pool_controller.address);
        });

        it('returns correct Sov Token address', async function () {
            expect(
                await pool.sovToken()
            ).to.eq(sov.address);
        });

        it('returns correct Reign Token address', async function () {
            expect(
                await pool.reignToken()
            ).to.eq(reign.address);
        }); 

        it('returns correct Underlying Token address', async function () {
            expect(
                await pool.token()
            ).to.eq(underlying1.address);
        }); 

    }); 

    describe('Syncing', async function () {

        it('totalSupply starts at 0', async function () {
            expect(await pool.totalSupply()).to.be.eq(0)
        });

        it('reserves are updated correctly after deposit', async function () {
            let amount = BigNumber.from(1400000).mul(helpers.tenPow18);
            await underlying1.connect(user).transfer(pool_address,amount);
            await pool.sync();
            expect(await pool.getReserves()).to.be.eq(amount)
        });

    });

    describe('Minting', async function () {

        it('mints the base amount of SoV for an empty pool', async function () {
            let amount1 = BigNumber.from(1400000).mul(helpers.tenPow18);

            await underlying1.connect(user).transfer(pool.address,amount1);
            expect(await underlying1.balanceOf(pool.address)).to.be.eq(amount1)

            await pool.mint(userAddress);

            let expected_amount_lp = amount1.sub(await pool.MINIMUM_LIQUIDITY())
            let expected_amount_sov = await pool.BASE_AMOUNT(); // Base amount

            expect(await sov.balanceOf(userAddress)).to.be.eq(expected_amount_sov)
            expect(await pool.balanceOf(userAddress)).to.be.eq(expected_amount_lp)
        });

        it('mints correct amount of Sov for non-empty pool', async function () {

            let amount1 = BigNumber.from(1400000).mul(helpers.tenPow18);

            await underlying1.connect(user).transfer(pool.address,amount1);
            await pool.mint(userAddress);

            let amount2 = BigNumber.from(1000000).mul(helpers.tenPow18);
            
            await underlying1.connect(user).transfer(pool_address,amount2);
            await pool.mint(userAddress);

            let expected_amount_lp = amount1.sub(await pool.MINIMUM_LIQUIDITY()).add(amount2)
        
            let new_sov = amount2.mul(await pool.BASE_AMOUNT()).div(await pool_controller.getPoolsTVL())
            let expected_amount_sov = (await pool.BASE_AMOUNT()).add(new_sov)

            expect(await sov.balanceOf(userAddress)).to.be.eq(expected_amount_sov)
            expect(await pool.balanceOf(userAddress)).to.be.eq(expected_amount_lp)
        });

        it('mints correct amounts for very small balances', async function () {

            let amount1 = BigNumber.from(1001); // min-liquidity +1

            await underlying1.connect(user).transfer(pool.address,amount1);
            await pool.mint(userAddress);

            let amount2 = BigNumber.from(1);
            
            await underlying1.connect(user).transfer(pool_address,amount2);
            await pool.mint(userAddress);

            let expected_amount_lp = amount1.sub(await pool.MINIMUM_LIQUIDITY()).add(amount2)
        
            let new_sov = amount2.mul(await pool.BASE_AMOUNT()).div(await pool_controller.getPoolsTVL())
            let expected_amount_sov = (await pool.BASE_AMOUNT()).add(new_sov)

            expect(await sov.balanceOf(userAddress)).to.be.eq(expected_amount_sov)
            expect(await pool.balanceOf(userAddress)).to.be.eq(expected_amount_lp)
        });

    });

    

    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);

        await underlying1.mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];

        userAddress = await user.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
        newAddress = await accounts[2].getAddress();
    }

});