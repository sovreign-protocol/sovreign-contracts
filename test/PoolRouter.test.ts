import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    ERC20Mock, BasketBalancerMock, ReignBalancerMock,  
    ReignToken, OracleMock, EpochClockMock, PoolRouter
} from '../typechain';
import * as deploy from './helpers/deploy';
import { prependOnceListener } from 'process';


describe('PoolRouter', function () {


/*

    let  svr: SvrToken, reign: ReignToken, underlying1: ERC20Mock, underlying2: ERC20Mock
    let  balancer: BasketBalancerMock, poolController:PoolController;
    let  oracle:OracleMock, interestStrategy: InterestStrategy, interestStrategy2: InterestStrategy;
    let  pool:Pool, pool2:Pool;
    let  epochClock: EpochClockMock
    let  poolRouter: PoolRouter

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let newUser: Signer, newUserAddress:string;
    let liquidityBufferAddress:string;

    let multiplier = BigNumber.from(3).mul(10**10);
    let offset = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));
    let baseDelta = 0;
    let decimalsFactor:BigNumber;

    let MIN_LIQUIDITY:BigNumber;


    before(async function () {

        await setupSigners();
        
        oracle = (await deploy.deployContract('OracleMock', [reignDAOAddress])) as OracleMock;
        oracle.update()
        let reignMock = (await deploy.deployContract('ReignBalancerMock')) as ReignBalancerMock;

        epochClock = (await deploy.deployContract('EpochClockMock', [helpers.stakingEpochStart])) as EpochClockMock;


        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[], [], reignMock.address])
        ) as BasketBalancerMock;


        await helpers.setTime(await helpers.getCurrentUnix());
    
   
    });

    beforeEach(async function() {
        
        underlying1 = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;
        underlying2 = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;

        decimalsFactor = BigNumber.from(10).pow(await underlying1.decimals())

        
        interestStrategy = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta])
            ) as InterestStrategy;

        interestStrategy2 = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta])
            ) as InterestStrategy;

        svr = (await deploy.deployContract('SvrToken', [userAddress])) as SvrToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;


        poolRouter = (await deploy.deployContract('PoolRouter', [reignDAOAddress])) as PoolRouter;

        poolController = (
            await deploy.deployContract('PoolController', [
                balancer.address, 
                svr.address, 
                reign.address,
                oracle.address, 
                reignDAOAddress, 
                epochClock.address, 
                poolRouter.address, 
                liquidityBufferAddress
            ])
        ) as PoolController; 

        await poolController.connect(reignDAO).createPool(
            underlying1.address, interestStrategy.address, oracle.address
        )

        let poolAddress = await poolController.allPools(0);

        //connect to deployed pool
        pool = (await deploy.deployContract('Pool')) as Pool;
        pool = pool.attach(poolAddress);

        await poolController.connect(reignDAO).createPool(
            underlying2.address, interestStrategy2.address, oracle.address
        )

        let pool2Address = await poolController.allPools(1);

        //connect to deployed pool
        pool2 = (await deploy.deployContract('Pool')) as Pool;
        pool2 = pool2.attach(pool2Address);

        await setupContracts()

        // set up access control
        await svr.connect(user).setController(poolController.address)
        await poolRouter.connect(reignDAO).setController(poolController.address)

        MIN_LIQUIDITY = BigNumber.from(await pool.MINIMUM_LIQUIDITY());
    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(poolRouter.address).to.not.eql(0).and.to.not.be.empty;
        });
        it('can set new controller', async function () {

            let poolController2 = (
                await deploy.deployContract('PoolController', [
                    balancer.address, 
                    svr.address, 
                    reign.address,
                    oracle.address, 
                    reignDAOAddress, 
                    epochClock.address, 
                    poolRouter.address, 
                    liquidityBufferAddress
                ])
            ) as PoolController; 

            await expect(poolRouter.connect(reignDAO).setController(poolController2.address)).to.not.be.reverted;
            expect(await poolRouter.connect(reignDAO).controller()).to.be.eq(poolController2.address)
        });

        it('revert if new controller is set by other', async function () {
            await expect(
                poolRouter.connect(user).setController(newUserAddress)
            ).to.be.revertedWith("Only the DAO can do this");
        });

        it('can deposit to pool', async function () {
            let amount = BigNumber.from(10000000000)

            depositToPool(amount.mul(5).toNumber(), pool)
            depositToPool(amount.mul(3).toNumber(), pool2)
            underlying1.mint(newUserAddress, amount.mul(10));
            underlying2.mint(newUserAddress, amount.mul(10));

            //approve underlying tokens
            await underlying1.connect(newUser).approve(poolRouter.address, amount);
            await underlying2.connect(newUser).approve(poolRouter.address, amount);


            reign.mint(newUserAddress, amount.mul(helpers.tenPow18));

            let totalFee = await poolRouter.connect(newUser).getTotalDepositFeeReign(
                [pool.address, pool2.address], [amount, amount]
            );
            //approve reign for fee
            await reign.connect(newUser).approve(poolRouter.address, totalFee);
            await poolRouter.connect(newUser).multiDeposit([pool.address, pool2.address], [amount, amount])

            expect(await pool.balanceOf(newUserAddress)).to.be.eq(amount);
            expect(await pool2.balanceOf(newUserAddress)).to.be.eq(amount);
        });


       

    });

    async function depositToPool (amount:number, poolUsed:Pool) {
        let amountBN = BigNumber.from(amount).mul(decimalsFactor);
        let depositFee = await poolUsed.getDepositFeeReign(amountBN);

        await reign.connect(user).approve(poolUsed.address, depositFee); 

        if (poolUsed == pool){
            await underlying1.connect(user).approve(poolUsed.address,amountBN);
            await poolUsed.mint(userAddress, amountBN);
        }else if (poolUsed == pool2){
            await underlying2.connect(user).approve(poolUsed.address,amountBN);
            await poolUsed.mint(userAddress, amountBN);
        }

        return amountBN;
    }


    async function rewardsPerPool(pool:Pool){
        let rewardsTotal = BigNumber.from(250000000).mul(helpers.tenPow18).div(4600000);
        return rewardsTotal.mul(await poolController.getTargetAllocation(pool.address)).div(1000000000)
    }
    

    async function setupContracts () {
        const cvValue = BigNumber.from(93000093).mul(helpers.tenPow18);

        await underlying1.mint(userAddress, cvValue);
        await underlying2.mint(userAddress, cvValue);
        await reign.connect(user).mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        happyPirate = accounts[1];
        reignDAO = accounts[2];
        newUser = accounts[3];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
        newUserAddress = await newUser.getAddress();
        liquidityBufferAddress = await accounts[4].getAddress();
    }

    */

});