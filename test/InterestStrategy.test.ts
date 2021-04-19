import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import { InterestStrategy } from '../typechain';
import * as deploy from './helpers/deploy';
import * as helpers from './helpers/helpers';


describe('InterestStrategy', function () {

    let interest: InterestStrategy;
    let reignDAO: Signer, reignDAOAddress: string;
    let user: Signer, userAddress: string;

    let multiplier = BigNumber.from(3).mul(10**10);
    let offset     = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));


    beforeEach(async function () {

        await setupSigners();

        interest = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset, reignDAOAddress])
            ) as InterestStrategy;
    });

    describe('interestRate', function () {

        it("returns positive rate when reserves < target", async () => {

            let rates = await interest.getInterestForReserve(1000,2000);
            
            expect(rates[0]).to.gt(0);
            expect(rates[1]).to.equal(0);
        }); 

        it("returns offset when reserves == target", async () => {

            let rates  = await interest.getInterestForReserve(2000,2000);
            let offset = await interest.getOffsett();

            let magnitudeAdjustment = await interest.magnitudeAdjust();

            expect(rates[0]).to.equal(offset.div(BigNumber.from(10).pow(magnitudeAdjustment)));
        });

        it("returns negative rates when reserves > target", async () => {
            let rates = await interest.getInterestForReserve(2000,1000);
            expect(rates[0]).to.equal(0);
            expect(rates[1]).to.gt(0);
        }); 
        
        it("returns for large numbers", async () => {

            let reserves = BigNumber.from(1400000000000000).mul(helpers.tenPow18); // 1.4 * 10**33
            let target   = BigNumber.from(700000000000000).mul(helpers.tenPow18);

            let rates = await interest.getInterestForReserve(reserves,target);
            expect(rates[0]).to.equal(0);
            expect(rates[1]).to.gt(0);
        }); 
    })
    describe('delta', function () {

        it("returns delta correctly for inside [-20,20]", async () => {

            let reserves = BigNumber.from(1100000).mul(helpers.tenPow18);
            let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

            let delta    = await interest.getDelta(reserves,target);
            let expected = ((target.sub(reserves).mul(helpers.tenPow18)).div(target)).mul(100)

            expect(delta).to.eq(expected)

            reserves = BigNumber.from(1000000).mul(helpers.tenPow18);
            target   = BigNumber.from(1100000).mul(helpers.tenPow18);

            delta    = await interest.getDelta(reserves,target);
            expected = ((target.sub(reserves).mul(helpers.tenPow18)).div(target)).mul(100)

            expect(delta).to.eq(expected)
        }); 

        it("returns delta correctly for outside [-20,20]", async () => {

            let reserves = BigNumber.from(50000000).mul(helpers.tenPow18);
            let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

            let delta    = await interest.getDelta(reserves,target);
            let expected = BigNumber.from(20).mul(helpers.tenPow18).mul(-1)

            expect(delta).to.eq(expected)

            reserves = BigNumber.from(1000000).mul(helpers.tenPow18);
            target   = BigNumber.from(50000000).mul(helpers.tenPow18);
            delta    = await interest.getDelta(reserves,target);
            expected = BigNumber.from(20).mul(helpers.tenPow18)

            expect(delta).to.eq(expected)
        }); 
    })

    describe('setters-getter', function () {
        it("sets correct offset", async () => {
            let newValue = BigNumber.from(5);
            await interest.connect(reignDAO).setOffsett(newValue);
            expect(await interest.getOffsett()).to.be.eq(newValue)
        });

        it("reverts if setOffset is called by other then DAO", async () => {
            let newValue = BigNumber.from(5);
            await expect(interest.connect(user).setOffsett(newValue)).to.be.revertedWith("SoV-Reign: FORBIDDEN")
        });
        
        it("sets correct multiplier", async () => {
            let newValue = BigNumber.from(5);
            await interest.connect(reignDAO).setMultiplier(newValue);
            expect(await interest.getMultiplier()).to.be.eq(newValue)
        });
        it("reverts if setMultiplier is called by other then DAO", async () => {
            let newValue = BigNumber.from(5);
            await expect(interest.connect(user).setMultiplier(newValue)).to.be.revertedWith("SoV-Reign: FORBIDDEN")
        });
    })

    describe('mock inputs', function () {
        it("returns correct values for mock inputs 1", async () => {

            let reserves = BigNumber.from(980000).mul(helpers.tenPow18);
            let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

            let delta = await interest.getDelta(reserves,target);
            let rates = await interest.getInterestForReserve(reserves,target);

            expect(rates[0]).to.equal(904347826086);
            expect(rates[1]).to.equal(0);
        }); 
    })

    describe('accrueInterest', function () {

        it('skips accrual if reserves is 0', async function () {
            let multiplier = await interest.withdrawFeeMultiplier();
            await interest.accrueInterest(0,1);
            expect(await interest.withdrawFeeMultiplier()).to.be.equal(multiplier)
        });

        it('returns correct withdraw fee multiplier', async function () {
            let blockBefore = await interest.blockNumberLast();
            await interest.accrueInterest(11000,10000);
            let blockAfter = await interest.blockNumberLast();

            let blockDelta = blockAfter.sub(blockBefore)

            let expectedWithdrawFeeMultiplier = (await interest.getInterestForReserve(11000,10000))[1]
            .mul(blockDelta)

            expect(await interest.withdrawFeeMultiplier()).to.not.be.eq(BigNumber.from(0))
            expect(await interest.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly accrues withdraw fee multiplier', async function () {
            let blockBefore = await interest.blockNumberLast();
            // make interest larger then target, this should set a non-zero withdraw fee
            await interest.accrueInterest(11000,10000);
            let blockAfter = await interest.blockNumberLast();
            let blockDelta = blockAfter.sub(blockBefore)

            let expectedWithdrawFeeMultiplier = (await interest.getInterestForReserve(11000,10000))[1]
            .mul(blockDelta)

            expect(await interest.withdrawFeeMultiplier()).to.not.be.eq(BigNumber.from(0))
            expect(await interest.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
            
            blockBefore = await interest.blockNumberLast();
            // increase interest further, this should increase the Withdraw fee
            await interest.accrueInterest(12000,10000);
            blockAfter = await interest.blockNumberLast();
            let blockDelta2 = blockAfter.sub(blockBefore)
            expectedWithdrawFeeMultiplier = expectedWithdrawFeeMultiplier.add(
                (await interest.getInterestForReserve(12000,10000)
                )[1]
            .mul(blockDelta2))

            expect(await interest.withdrawFeeMultiplier()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly reduces withdraw fee multiplier', async function () {
            await interest.accrueInterest(12000,10000);

            let withdrawFeeMultiplierBefore = await interest.withdrawFeeMultiplier()
            await interest.accrueInterest(11000,10000);
            expect(await interest.withdrawFeeMultiplier()).to.be.lt(withdrawFeeMultiplierBefore)

            withdrawFeeMultiplierBefore = await interest.withdrawFeeMultiplier()
            await interest.accrueInterest(10500, 10000);
            expect(await interest.withdrawFeeMultiplier()).to.be.lt(withdrawFeeMultiplierBefore)
        });

        it('correctly sets withdraw fee to zero if interest becomes positive', async function () {
            await interest.accrueInterest(12000, 10000);

            expect(await interest.withdrawFeeMultiplier()).to.be.gt(0).and.not.be.eq(0)

            await interest.accrueInterest(10000,15000);
            expect(await interest.withdrawFeeMultiplier()).to.be.eq(0)
        });

    }) 
    
    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];
        userAddress = await user.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
    }
});