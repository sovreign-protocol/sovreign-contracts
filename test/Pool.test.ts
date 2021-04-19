import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    Erc20Mock, BasketBalancerMock, PoolController, Pool, SvrToken, ReignToken, OracleMock, InterestStrategy
} from '../typechain';
import * as deploy from './helpers/deploy';
import { prependOnceListener } from 'process';


describe('Pool', function () {

    let  svr: SvrToken, reign: ReignToken, underlying1: Erc20Mock, underlying2: Erc20Mock
    let  balancer: BasketBalancerMock, poolController:PoolController;
    let  oracle:OracleMock, interestStrategy: InterestStrategy;
    let  pool:Pool, pool2:Pool;

    let user: Signer, userAddress: string;
    let treasury: Signer, treasuryAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let newUser: Signer, newUserAddress:string;


    before(async function () {

        await setupSigners();
        
        underlying1 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        underlying2 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        
        oracle = (await deploy.deployContract('OracleMock')) as OracleMock;


        let multiplier = BigNumber.from(3).mul(10**10);
        let offset = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));
        interestStrategy = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset])
            ) as InterestStrategy;;
 

        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[], []])
        ) as BasketBalancerMock;
    
   
    });

    beforeEach(async function() {

        svr = (await deploy.deployContract('SvrToken', [userAddress])) as SvrToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;

        poolController = (
            await deploy.deployContract('PoolController', [
                balancer.address, svr.address, reign.address, reignDAOAddress, treasuryAddress
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
            underlying2.address, interestStrategy.address, oracle.address
        )

        let pool2Address = await poolController.allPools(1);

        //connect to deployed pool
        pool2 = (await deploy.deployContract('Pool')) as Pool;
        pool2 = pool2.attach(pool2Address);

        await setupContracts()

        svr.connect(user).setController(poolController.address)
        reign.connect(user).setController(poolController.address)
        

    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(poolController.address).to.not.eql(0).and.to.not.be.empty;
            expect(pool.address).to.not.eql(0).and.to.not.be.empty;
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
            await mintSVR(100000,pool)
            let transfers = BigNumber.from(10)
            await pool.connect(user).transfer(newUserAddress,transfers);
            expect(await pool.balanceOf(newUserAddress)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await mintSVR(100000,pool)
            let transfers = (await pool.balanceOf(userAddress)).add(1000)
            await expect(
                pool.connect(user).transfer(newUserAddress,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await mintSVR(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            expect(await pool.allowance(userAddress,newUserAddress)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await mintSVR(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await pool.connect(newUser).transferFrom(userAddress,treasuryAddress, allow);
            expect(await pool.balanceOf(treasuryAddress)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await mintSVR(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await expect(
                pool.connect(user).transferFrom(userAddress,treasuryAddress,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await mintSVR(100000,pool)
            let allow = BigNumber.from(10)
            await pool.connect(user).approve(newUserAddress,allow);
            await pool.connect(newUser).transferFrom(userAddress,treasuryAddress, allow.sub(5));
            expect(await pool.allowance(userAddress,newUserAddress)).to.be.eq(allow.sub(5))
        })
    })

    describe('Syncing', async function () {

        it('totalSupply starts at 0', async function () {
            expect(await pool.totalSupply()).to.be.eq(0)
        });

        it('reserves are updated correctly after deposit', async function () {
            let amount = BigNumber.from(1100000).mul(helpers.tenPow18);
            await underlying1.connect(user).transfer(pool.address,amount);
            await pool.sync();
            expect(await pool.getReserves()).to.be.eq(amount)
        });

    });

    describe('Computing Fees', async function () {

        it('skips accrual if total supply is 0', async function () {
            let multiplier = await pool.withdrawFeeMultiplier();
            await pool._accrueInterest();
            expect(await pool.withdrawFeeMultiplier()).to.be.equal(multiplier)
        });


        it('returns correct expected deposit fee', async function () {
            await mintSVR(11000,pool);
            await mintSVR(10000,pool2);

            let amount = BigNumber.from(1000)

            let target = await poolController.getTargetSize(pool.address)
            let reservesAfter = (await pool.getReserves()).add(amount)

            let expectedDepositFee = (await poolController.getInterestRate(pool.address,reservesAfter,target))[1]
            .mul(await pool.depositFeeMultiplier())
            .mul(amount)
            .mul(await poolController.getTokenPrice(pool.address))
            .div(await poolController.getReignPrice())
            .div(helpers.tenPow18)
            
            expect(await pool.getDepositFeeReign(amount)).to.be.not.eq(BigNumber.from(0))
            expect(await pool.getDepositFeeReign(amount)).to.be.eq(expectedDepositFee)
        });

        it('returns correct expected withdraw Fee', async function () {
            await mintSVR(10000,pool);

            let amount = BigNumber.from(1000)

            let expectedWithdrawFee = (await pool.withdrawFeeMultiplier())
            .mul(amount)
            .mul(await poolController.getTokenPrice(pool.address))
            .div(await poolController.getReignPrice())
            .div(helpers.tenPow18)
            

            expect(await pool.getWithdrawFeeReign(amount)).to.be.eq(expectedWithdrawFee)
        });


        it('returns correct withdraw fee multiplier', async function () {
            let blockBefore = await pool.blockNumberLast();
            await mintSVR(10000,pool);
            let blockAfter = await pool.blockNumberLast();

            let blockDelta = blockAfter.sub(blockBefore)

            let expectedWithdrawFeeMultiplier = (await interestStrategy.getInterestForReserve(2,1))[1]
            .mul(blockDelta)

            expect(await pool.withdrawFeeMultiplier()).to.not.be.eq(BigNumber.from(0))
            expect(await pool.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly accrues withdraw fee multiplier', async function () {
            let blockBefore = await pool.blockNumberLast();
            // make pool larger then target, this should set a non-zero withdraw fee
            await mintSVR(9000,pool2);
            await mintSVR(10000,pool);
            let blockAfter = await pool.blockNumberLast();
            let blockDelta = blockAfter.sub(blockBefore)

            let target = await poolController.getTargetSize(pool.address)
            let reserves = await pool.getReserves()
            let expectedWithdrawFeeMultiplier = (await poolController.getInterestRate(pool.address,reserves,target))[1]
            .mul(blockDelta)

            expect(await pool.withdrawFeeMultiplier()).to.not.be.eq(BigNumber.from(0))
            expect(await pool.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
            
            blockBefore = await pool.blockNumberLast();
            // increase pool further, this should increase the Withdraw fee
            await mintSVR(10000,pool);
            blockAfter = await pool.blockNumberLast();
            let blockDelta2 = blockAfter.sub(blockBefore)

            target = await poolController.getTargetSize(pool.address)
            reserves = await pool.getReserves()
            expectedWithdrawFeeMultiplier = expectedWithdrawFeeMultiplier.add((await interestStrategy.getInterestForReserve(reserves,target))[1]
            .mul(blockDelta2))

            expect(await pool.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly reduces withdraw fee multiplier', async function () {
            await mintSVR(30000,pool);
            await mintSVR(20000,pool2);

            let withdrawFeeMultiplierBefore = await pool.withdrawFeeMultiplier()
            await burnSVR(2000, pool);
            expect(await pool.withdrawFeeMultiplier()).to.be.lt(withdrawFeeMultiplierBefore)

            withdrawFeeMultiplierBefore = await pool.withdrawFeeMultiplier()
            await burnSVR(2000, pool);
            expect(await pool.withdrawFeeMultiplier()).to.be.lt(withdrawFeeMultiplierBefore)
        });

        it('correctly sets withdraw fee to zero if interest becomes positive', async function () {
            await mintSVR(30000,pool);
            await mintSVR(20000,pool2);

            let withdrawFeeMultiplierBefore = await pool.withdrawFeeMultiplier()
            await burnSVR(6000, pool);
            expect(await pool.withdrawFeeMultiplier()).to.not.be.eq(0)
            expect(await pool.withdrawFeeMultiplier()).to.be.lt(withdrawFeeMultiplierBefore)

            withdrawFeeMultiplierBefore = await pool.withdrawFeeMultiplier()
            await burnSVR(20000, pool);
            expect(await pool.withdrawFeeMultiplier()).to.be.eq(0)
        });

       

    });

    describe('Minting', async function () {

        it('mints the the correct amount of LP Tokens', async function () {
            let amount = await mintSVR(100000,pool)

            expect(await underlying1.balanceOf(pool.address)).to.be.eq(amount)
            let expected_amount_lp = amount.sub(await pool.MINIMUM_LIQUIDITY())
            expect(await pool.balanceOf(userAddress)).to.be.eq(expected_amount_lp)

            await pool.connect(user).transfer(newUserAddress,BigNumber.from(10));
            expect(await pool.balanceOf(newUserAddress)).to.be.eq(BigNumber.from(10))
        });

        it('mints the base amount of Svr for an empty pool', async function () {
            let amount = await mintSVR(100000,pool)
            expect(await underlying1.balanceOf(pool.address)).to.be.eq(amount)

            let expected_amount_svr = await pool.BASE_SVR_AMOUNT(); // Base amount
            expect(await svr.balanceOf(userAddress)).to.be.eq(expected_amount_svr)
        });

        it('mints correct amount of Svr for non-empty pool', async function () {
            await mintSVR(100000,pool2)
            await mintSVR(100000,pool)

            let svrBalanceAfter = await svr.balanceOf(userAddress);
            let svrSupplyAfter = await svr.totalSupply();

            let amount2 = await mintSVR(110000,pool)

            let underlyingPrice = await poolController.getTokenPrice(pool.address);
    
            let newSvr = amount2.mul(underlyingPrice)
                .mul(svrSupplyAfter)
                .div(await poolController.getPoolsTVL())
                .div(helpers.tenPow18)

            let expectedAmountSvr = (svrBalanceAfter).add(newSvr)

            expect(await svr.balanceOf(userAddress)).to.be.eq(expectedAmountSvr)
        });

        it('mints correct amounts of SoV for very small balances', async function () {
            await mintSVR(1001,pool)

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

        it('transfers out the correct amount of underlying', async function () {
            await mintSVR(110000,pool)

            let userBalanceUnderlying = await underlying1.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);
            await reign.connect(user).approve(pool.address, withdrawFee);
            await pool.connect(user).burn(amountToBurn);

            expect( await underlying1.balanceOf(userAddress)).to.eq(userBalanceUnderlying.add(amountToBurn))
        });

        it('burns the correct amount of LP token', async function () {
            await mintSVR(110000,pool)

            let userBalanceLP = await pool.balanceOf(userAddress);
            let amountToBurn = BigNumber.from(100000).mul(helpers.tenPow18);

            let withdrawFee = await pool.getWithdrawFeeReign(amountToBurn);
            await reign.connect(user).approve(pool.address, withdrawFee);

            await pool.connect(user).burn(amountToBurn);

            expect( await pool.balanceOf(userAddress)).to.eq(userBalanceLP.sub(amountToBurn))
        });

        it('burns the correct amount of SoV token', async function () {
            await mintSVR(110000,pool)

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

    async function mintSVR (amount:number, poolUsed:Pool) {
        let amountBN = BigNumber.from(amount).mul(helpers.tenPow18);
        let depositFee = await poolUsed.getDepositFeeReign(amountBN);

        await reign.connect(user).approve(poolUsed.address, depositFee); 
        await underlying1.connect(user).transfer(poolUsed.address,amountBN);
        await underlying2.connect(user).transfer(poolUsed.address,amountBN);
        await poolUsed.mint(userAddress);

        return amountBN;
    }

    async function burnSVR (amount:number, poolUsed:Pool) {
        let amountToBurn = BigNumber.from(amount).mul(helpers.tenPow18);
        let withdrawFee = await poolUsed.getWithdrawFeeReign(amountToBurn);

        await reign.connect(user).approve(poolUsed.address, withdrawFee);
        await poolUsed.connect(user).burn(amountToBurn);

        return amountToBurn
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
        treasury = accounts[1];
        reignDAO = accounts[2];
        newUser = accounts[2];

        userAddress = await user.getAddress();
        treasuryAddress = await treasury.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
        newUserAddress = await newUser.getAddress();
    }

});