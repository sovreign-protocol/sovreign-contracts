import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    ERC20Mock, BasketBalancerMock, PoolController, Pool, SvrToken, ReignToken, OracleMock, InterestStrategy,
} from '../typechain';
import * as deploy from './helpers/deploy';
import { prependOnceListener } from 'process';


describe('Pool', function () {

    let  svr: SvrToken, reign: ReignToken, underlying1: ERC20Mock, underlying2: ERC20Mock
    let  balancer: BasketBalancerMock, poolController:PoolController;
    let  oracle:OracleMock, interestStrategy: InterestStrategy, interestStrategy2: InterestStrategy;
    let  pool:Pool, pool2:Pool;

    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let newUser: Signer, newUserAddress:string;
    let liquidityBufferAddress:string;

    let multiplier = BigNumber.from(3).mul(10**10);
    let offset = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));
    let baseDelta = 0;


    before(async function () {

        await setupSigners();
        
        oracle = (await deploy.deployContract('OracleMock', [reignDAOAddress])) as OracleMock;


        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[], []])
        ) as BasketBalancerMock;


        await helpers.setNextBlockTimestamp(await helpers.getCurrentUnix());
    
   
    });

    beforeEach(async function() {
        
        underlying1 = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;
        underlying2 = (await deploy.deployContract('ERC20Mock')) as ERC20Mock;

        
        interestStrategy = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta,reignDAOAddress, helpers.stakingEpochStart])
            ) as InterestStrategy;

        interestStrategy2 = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta,reignDAOAddress, helpers.stakingEpochStart])
            ) as InterestStrategy;

        svr = (await deploy.deployContract('SvrToken', [userAddress])) as SvrToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;

        poolController = (
            await deploy.deployContract('PoolController', [
                balancer.address, svr.address, reign.address, reignDAOAddress, liquidityBufferAddress
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
        await interestStrategy.connect(reignDAO).setPool(poolAddress)
        await interestStrategy2.connect(reignDAO).setPool(pool2Address)
    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(poolController.address).to.not.eql(0).and.to.not.be.empty;
            expect(pool.address).to.not.eql(0).and.to.not.be.empty;
        });

        it('reverts if initialised again', async function () {
            await expect(
                pool.connect(user).initialize(underlying1.address)
                ).to.be.revertedWith("Can not be initialized again");
        });


        it('totalSupply starts at 0', async function () {
            expect(await pool.totalSupply()).to.be.eq(0)
        });

        it('should allow to skim', async function () {
            let amount = BigNumber.from(27);
            await underlying1.connect(user).transfer(pool.address,amount);
            expect(await underlying1.balanceOf(pool.address)).to.be.equal(amount);
            await pool.skim(newUserAddress);
            expect(await underlying1.balanceOf(newUserAddress)).to.be.equal(amount);
        });
    
    });


    describe('Getters and Setters', async function () {

        it('returns correct Factory address', async function () {
            expect(
                await pool.controllerAddress()
            ).to.eq(poolController.address);
        });

        it('returns correct Svr Token address', async function () {
            expect(
                await pool.svrToken()
            ).to.eq(svr.address);
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

    describe('ERC-20', async function () {

        it('transfers amounts correctly', async function () {
            await depositToPool(100000,pool)
            let transfers = BigNumber.from(10)
            await pool.connect(user).transfer(newUserAddress,transfers);
            expect(await pool.balanceOf(newUserAddress)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await depositToPool(100000,pool)
            let transfers = (await pool.balanceOf(userAddress)).add(1000)
            await expect(
                pool.connect(user).transfer(newUserAddress,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await depositToPool(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            expect(await pool.allowance(userAddress,newUserAddress)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await depositToPool(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await pool.connect(newUser).transferFrom(userAddress,happyPirateAddress, allow);
            expect(await pool.balanceOf(happyPirateAddress)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await depositToPool(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await expect(
                pool.connect(user).transferFrom(userAddress,happyPirateAddress,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await depositToPool(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await pool.connect(newUser).transferFrom(userAddress,happyPirateAddress, allow.sub(5));
            expect(await pool.allowance(userAddress,newUserAddress)).to.be.eq(allow.sub(5))
        })
    })
    describe('Computing Fees', async function () {

        it('returns correct expected deposit fee', async function () {
            await depositToPool(11000,pool);
            await depositToPool(10000,pool2);

            let amount = BigNumber.from(1000)

            let target = await poolController.getTargetSize(pool.address)
            let reservesAfter = (await pool.getReserves()).add(amount)

            let expectedDepositFee = (await interestStrategy.getFormulaOutput(reservesAfter,target))[1]
            .mul(await pool.depositFeeMultiplier())
            .mul(amount)
            .mul(await poolController.getTokenPrice(pool.address))
            .div(await poolController.getReignPrice())
            .div(helpers.tenPow18)
            
            expect(await pool.getDepositFeeReign(amount)).to.be.eq(60)
            expect(await pool.getDepositFeeReign(amount)).to.be.eq(expectedDepositFee)
        });

        it('returns correct expected withdraw Fee', async function () {

            await depositToPool(1,pool);
            await helpers.mineBlocks(100)
            await depositToPool(1000,pool);


            let amount = BigNumber.from(1000)

            let expectedWithdrawFee = (await interestStrategy.withdrawFeeAccrued())
            .mul(await rewardsPerPool(pool))
            .mul(amount)
            .div(await pool.getReserves())
            .div(helpers.tenPow18)


            expect(await pool.getWithdrawFeeReign(amount)).to.not.eq(0)
            expect(await pool.getWithdrawFeeReign(amount)).to.be.eq(expectedWithdrawFee)
        });

    });

    describe('Minting', async function () {

        it('reverts if amount is 0', async function () {
            let amountBN = BigNumber.from(0).mul(helpers.tenPow18);
            let depositFee = await pool.getDepositFeeReign(amountBN);

            await reign.connect(user).approve(pool.address, depositFee); 
            await underlying1.connect(user).transfer(pool.address,amountBN);
            await underlying2.connect(user).transfer(pool.address,amountBN);
            await expect(pool.mint(userAddress)).to.be.revertedWith("Can only issue positive amounts")
        });

        it('reverts if deposit fee allowance is to low', async function () {
            await depositToPool(11000,pool);
            await depositToPool(10000,pool2);

            let amountBN = BigNumber.from(10000).mul(helpers.tenPow18);

            await underlying1.connect(user).transfer(pool.address,amountBN);
            await expect(pool.mint(userAddress)).to.be.revertedWith("Insufficient allowance")
        });

        it('reverts if first deposit amount is equal min liquidity', async function () {
            let amountBN = await pool.MINIMUM_LIQUIDITY();
            let depositFee = await pool.getDepositFeeReign(amountBN);

            await reign.connect(user).approve(pool.address, depositFee); 
            await underlying1.connect(user).transfer(pool.address,amountBN);
            await expect(pool.mint(userAddress)).to.be.revertedWith("Insufficient Liquidity Minted")
        });

        it('mints the correct amount of LP Tokens', async function () {
            let amount = await depositToPool(100000,pool)

            expect(await underlying1.balanceOf(pool.address)).to.be.eq(amount)
            let expected_amount_lp = amount.sub(await pool.MINIMUM_LIQUIDITY())
            expect(await pool.balanceOf(userAddress)).to.be.eq(expected_amount_lp)

            await pool.connect(user).transfer(newUserAddress,BigNumber.from(10));
            expect(await pool.balanceOf(newUserAddress)).to.be.eq(BigNumber.from(10))
        });

        it('mints the base amount of Svr for an empty pool', async function () {
            let amount = await depositToPool(100000,pool)
            expect(await underlying1.balanceOf(pool.address)).to.be.eq(amount)

            let expected_amount_svr = await pool.BASE_SVR_AMOUNT(); // Base amount
            expect(await svr.balanceOf(userAddress)).to.be.eq(expected_amount_svr)
        });

        it('mints correct amount of Svr for non-empty pool', async function () {
            await depositToPool(930000,pool2) //mints base amount
            await depositToPool(930000,pool)

            let svrBalanceAfter = await svr.balanceOf(userAddress);
            let svrSupplyAfter = await svr.totalSupply();

            let amount2 = await depositToPool(110000,pool)

            let underlyingPrice = await poolController.getTokenPrice(pool.address);
    
            let newSvr = amount2.mul(underlyingPrice)
                .mul(svrSupplyAfter)
                .div(await poolController.getPoolsTVL())
                .div(helpers.tenPow18)

            let expectedAmountSvr = (svrBalanceAfter).add(newSvr)

            expect(await svr.balanceOf(userAddress)).to.be.eq(expectedAmountSvr)
        });

        it('mints correct amounts of Svr for very small balances', async function () {
            await depositToPool(1001,pool)

            let svrBalanceAfter = await svr.balanceOf(userAddress);
            let svrSupplyAfter = await svr.totalSupply();

            let amount2 = BigNumber.from(1);

            let depositFee = await pool.getDepositFeeReign(amount2);
            await reign.connect(user).approve(pool.address, depositFee); 
            await underlying1.connect(user).transfer(pool.address,amount2);
            await pool.mint(userAddress);
    

            let underlyingPrice = await poolController.getTokenPrice(pool.address);
        
            let newSvr = amount2.mul(underlyingPrice)
                .mul(svrSupplyAfter)
                .div(await poolController.getPoolsTVL())
                .div(helpers.tenPow18)
            let expectedAmountSvr = (svrBalanceAfter).add(newSvr)

            expect(await svr.balanceOf(userAddress)).to.be.eq(expectedAmountSvr)
        });

    });

    describe('Burning', async function () {


        it('does not require fee if Withdraw fee is 0)', async function () {
            await depositToPool(110000,pool2) 
            await depositToPool(100000,pool)// this makes pool 1 to small -> no withdraw fee
            
            let amountToBurn = BigNumber.from(10).mul(helpers.tenPow18);
            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);

            expect(withdrawFee).to.eq(0)

            await expect(pool.connect(user).burn(amountToBurn)).to.not.be.reverted;
        });

        it('reverts if amount is 0', async function () {
            await depositToPool(110000,pool)

            let userBalanceLP = await pool.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);
            await reign.connect(user).approve(pool.address, withdrawFee);

            await expect(pool.connect(user).burn(0)).to.be.revertedWith("Can only burn positive amounts")

        });

        it('reverts if withdraw fee allowance is too low', async function () {
            await depositToPool(110000,pool)

            let userBalanceLP = await pool.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            await pool.getWithdrawFeeReign(amountToBurn);

            await expect(pool.connect(user).burn(userBalanceLP)).to.be.revertedWith("Insufficient allowance")

        });

        it('transfers out the correct amount of underlying', async function () {
            await depositToPool(110000,pool)

            let userBalanceUnderlying = await underlying1.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);
            await reign.connect(user).approve(pool.address, withdrawFee);
            await pool.connect(user).burn(amountToBurn);

            expect( await underlying1.balanceOf(userAddress)).to.eq(userBalanceUnderlying.add(amountToBurn))
        });

        it('burns the correct amount of LP token', async function () {
            await depositToPool(110000,pool)

            let userBalanceLP = await pool.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);
            await reign.connect(user).approve(pool.address, withdrawFee);

            await pool.connect(user).burn(amountToBurn);

            expect( await pool.balanceOf(userAddress)).to.eq(userBalanceLP.sub(amountToBurn))
        });

        it('burns the correct amount of Svr token', async function () {
            await depositToPool(110000,pool)

            let svrBalanceAfter = await svr.balanceOf(userAddress);
            let svrSupplyAfter = await svr.totalSupply();
            
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);
            let underlyingPrice = await poolController.getTokenPrice(pool.address)

            let svrBurned = amountToBurn.mul(underlyingPrice)
                .mul(svrSupplyAfter)
                .div(await poolController.getPoolsTVL())
                .div(helpers.tenPow18)
            let expectedAmountSvr = (svrBalanceAfter).sub(svrBurned)

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);

            await reign.connect(user).approve(pool.address, withdrawFee);
            await pool.connect(user).burn(amountToBurn);

            expect( await svr.balanceOf(userAddress)).to.eq(expectedAmountSvr)
        });

       

    });

    async function depositToPool (amount:number, poolUsed:Pool) {
        let amountBN = BigNumber.from(amount).mul(helpers.tenPow18);
        let depositFee = await poolUsed.getDepositFeeReign(amountBN);

        await reign.connect(user).approve(poolUsed.address, depositFee); 
        if (poolUsed == pool){
            await underlying1.connect(user).transfer(poolUsed.address,amountBN);
            await poolUsed.mint(userAddress);
        }else if (poolUsed == pool2){
            await underlying2.connect(user).transfer(poolUsed.address,amountBN);
            await poolUsed.mint(userAddress);
        }

        return amountBN;
    }


    async function rewardsPerPool(pool:Pool){
        let rewardsTotal=BigNumber.from(25000000).mul(helpers.tenPow18).div(4600000);
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

});