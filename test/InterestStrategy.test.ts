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
    let baseDelta = 0;

    beforeEach(async function () {

        await setupSigners();

        interest = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset,baseDelta, reignDAOAddress, helpers.stakingEpochStart])
            ) as InterestStrategy;
    });

    describe('interestRate', function () {

        it("returns positive rate when reserves < target", async () => {

            let rates = await interest.getInterestForReserve(100,110);
            
            expect(rates[0]).to.gt(0);
            expect(rates[1]).to.equal(0);
        }); 

        it("returns offset when reserves == target", async () => {

            let magnitudeAdjustment = await interest.MAGNITUDE_ADJUST();

            let rates  = await interest.getInterestForReserve(100,100);
            let offset = (await interest.offset()).div(BigNumber.from(10).pow(magnitudeAdjustment));

            expect(rates[0]).to.equal(offset);
        });

        it("returns negative rates when reserves > target", async () => {
            let rates = await interest.getInterestForReserve(110,100);
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
            let expected = ((target.sub(reserves).mul(helpers.tenPow18).mul(100)).div(target))

            expect(delta).to.eq(expected)

            reserves = BigNumber.from(1000000).mul(helpers.tenPow18);
            target   = BigNumber.from(1100000).mul(helpers.tenPow18);

            delta    = await interest.getDelta(reserves,target);
            expected = ((target.sub(reserves).mul(helpers.tenPow18).mul(100)).div(target))

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
            await interest.connect(reignDAO).setOffset(newValue);
            expect(await interest.offset()).to.be.eq(newValue)
        });

        it("reverts if setOffset is called by other then DAO", async () => {
            let newValue = BigNumber.from(5);
            await expect(interest.connect(user).setOffset(newValue)).to.be.revertedWith("SoV-Reign: FORBIDDEN")
        });

        it("sets correct baseDelta", async () => {
            let newValue = BigNumber.from(5);
            await interest.connect(reignDAO).setBaseDelta(newValue);
            expect(await interest.baseDelta()).to.be.eq(newValue)
        });

        it("reverts if setOffset is called by other then DAO", async () => {
            let newValue = BigNumber.from(5);
            await expect(interest.connect(user).setBaseDelta(newValue)).to.be.revertedWith("SoV-Reign: FORBIDDEN")
        });
        
        it("sets correct multiplier", async () => {
            let newValue = BigNumber.from(5);
            await interest.connect(reignDAO).setMultiplier(newValue);
            expect(await interest.multiplier()).to.be.eq(newValue)
        });
        it("reverts if setMultiplier is called by other then DAO", async () => {
            let newValue = BigNumber.from(5);
            await expect(interest.connect(user).setMultiplier(newValue)).to.be.revertedWith("SoV-Reign: FORBIDDEN")
        });

    })

    describe('epochs', function () {
        it("returns correct Epoch", async () => {
            expect(await interest.getCurrentEpoch()).to.be.eq(BigNumber.from(await helpers.getCurrentEpoch()))
        });
    })

    describe('base Interest', function () {
        it("returns correct base Interest for Delta = 0", async () => {
            let magnitudeAdjustment = await interest.MAGNITUDE_ADJUST();

            let rates  = await interest.getBaseInterest();
            let offset = (await interest.offset()).div(BigNumber.from(10).pow(magnitudeAdjustment));

            expect(rates[0]).to.equal(offset);
        });

        it("returns correct base Interest for Delta > 0", async () => {
            let newBaseDelta = BigNumber.from(-15).mul(helpers.tenPow18);
            await interest.connect(reignDAO).setBaseDelta(newBaseDelta)


            let rates  = await interest.getBaseInterest();
            let expected = (await interest.getInterestForReserve(115, 100));
            expect(rates[1]).to.equal(expected[1]);
        });

        it("returns correct base Interest for Delta < 0", async () => {
            let newBaseDelta = BigNumber.from(15).mul(helpers.tenPow18);
            await interest.connect(reignDAO).setBaseDelta(newBaseDelta);

            let rates  = await interest.getBaseInterest();
            let expected = (await interest.getInterestForReserve(85,100));
            expect(rates[0]).to.equal(expected[0]);
        });
    });

    describe('mock inputs', function () {
        it("returns correct values for mock inputs 1", async () => {

            let reserves = BigNumber.from(980000).mul(helpers.tenPow18);
            let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

            let delta = await interest.getDelta(reserves,target);
            let rates = await interest.getInterestForReserve(reserves,target);

            expect(rates[0]).to.equal(904347826086);
            expect(rates[1]).to.equal(0);
        }); 

        it("returns correct values for mock inputs 2", async () => {

            let reserves = BigNumber.from(1000000).mul(helpers.tenPow18);
            let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

            let blockBefore = await interest.blockNumberLast();
            await interest.accrueInterest(reserves,target);
            let blockAfter = await interest.blockNumberLast();

            // as base Delta is 0 for a Delta=0 input the normalizes value is 1
            // and accumulated value should equal the number of blocks
            let blockDelta = (blockAfter.sub(blockBefore))
            expect(
                (await interest.getEpochRewards(await helpers.getCurrentEpoch())).div(helpers.tenPow18)
                ).to.be.eq(blockDelta)
        }); 
           
    })

    describe('accrueInterest Negative', function () {

        it('skips accrual if reserves is 0', async function () {
            let multiplier = await interest.withdrawFeeAccrued();
            await interest.accrueInterest(0,1);
            expect(await interest.withdrawFeeAccrued()).to.be.equal(multiplier)
        });

        it('returns correct withdraw fee multiplier', async function () {
            let blockBefore = await interest.blockNumberLast();
            await interest.accrueInterest(11000,10000);
            let blockAfter = await interest.blockNumberLast();

            let blockDelta = blockAfter.sub(blockBefore)

            let interests = (await interest.getInterestForReserve(11000,10000))
            let expectedWithdrawFeeMultiplier = (await interest.getNormalizedToBase(interests[0],interests[1]))[1]
            .mul(blockDelta)

            expect(await interest.withdrawFeeAccrued()).to.not.be.eq(BigNumber.from(0))
            expect(await interest.withdrawFeeAccrued()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly accrues withdraw fee multiplier', async function () {
            let blockBefore = await interest.blockNumberLast();
            // make interest larger then target, this should set a non-zero withdraw fee
            await interest.accrueInterest(11000,10000);
            let blockAfter = await interest.blockNumberLast();
            let blockDelta = blockAfter.sub(blockBefore)

            let interestsBase = (await interest.getInterestForReserve(11000,10000))
            let expectedWithdrawFeeMultiplier = (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[1]
            .mul(blockDelta)

            expect(await interest.withdrawFeeAccrued()).to.not.be.eq(BigNumber.from(0))
            expect(await interest.withdrawFeeAccrued()).to.be.eq(expectedWithdrawFeeMultiplier)
            
            blockBefore = await interest.blockNumberLast();
            // increase interest further, this should increase the Withdraw fee
            await interest.accrueInterest(12000,10000);
            blockAfter = await interest.blockNumberLast();
            let blockDelta2 = blockAfter.sub(blockBefore)

            interestsBase = (await interest.getInterestForReserve(12000,10000))

            expectedWithdrawFeeMultiplier = expectedWithdrawFeeMultiplier.add(
                (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[1]
            .mul(blockDelta2))

            expect(await interest.withdrawFeeAccrued()).to.be.eq(expectedWithdrawFeeMultiplier)
        });

        it('correctly reduces withdraw fee multiplier', async function () {
            await interest.accrueInterest(12000,10000);

            let withdrawFeeAccruedBefore = await interest.withdrawFeeAccrued()
            await interest.accrueInterest(11000,10000);
            expect(await interest.withdrawFeeAccrued()).to.be.lt(withdrawFeeAccruedBefore)

            withdrawFeeAccruedBefore = await interest.withdrawFeeAccrued()
            await interest.accrueInterest(10500, 10000);
            expect(await interest.withdrawFeeAccrued()).to.be.lt(withdrawFeeAccruedBefore)

            withdrawFeeAccruedBefore = await interest.withdrawFeeAccrued()
            await interest.accrueInterest(10400, 10000);
            expect(await interest.withdrawFeeAccrued()).to.be.lt(withdrawFeeAccruedBefore)
        });

        it('correctly sets withdraw fee to zero if interest becomes positive', async function () {
            await interest.accrueInterest(12000, 10000);

            expect(await interest.withdrawFeeAccrued()).to.be.gt(0).and.not.be.eq(0)

            // first time it's not reset
            await interest.accrueInterest(10000,15000);
            expect(await interest.withdrawFeeAccrued()).to.be.gt(0).and.not.be.eq(0)

            // second interaction makes reset
            await interest.accrueInterest(10000,15000);
            expect(await interest.withdrawFeeAccrued()).to.be.eq(0)
        });

    }) 

    describe('accrueInterest Positive', function () {

        it('skips accrual if reserves is 0', async function () {
            let multiplier = await interest.withdrawFeeAccrued();
            await interest.accrueInterest(0,1);
            expect(await interest.withdrawFeeAccrued()).to.be.equal(multiplier)
        });

        it('correctly accrues rewards for an epoch', async function () {
            let blockBefore = await interest.blockNumberLast();
            // make interest larger then target, this should set a non-zero withdraw fee
            await interest.accrueInterest(10000,11000);
            let blockAfter = await interest.blockNumberLast();
            let blockDelta = blockAfter.sub(blockBefore)

            let interestsBase = (await interest.getInterestForReserve(10000,11000))
            let expectedEpochRewards = (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[0]
            .mul(blockDelta)

            expect(await interest.getEpochRewards(await helpers.getCurrentEpoch())).to.be.eq(expectedEpochRewards)
            
            blockBefore = await interest.blockNumberLast()
            await interest.accrueInterest(10000,11000);
            blockAfter = await interest.blockNumberLast();
            let blockDelta2 = blockAfter.sub(blockBefore)

            interestsBase = (await interest.getInterestForReserve(10000,11000))

            expectedEpochRewards = expectedEpochRewards.add(
                (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[0]
            .mul(blockDelta2))

            expect(await interest.getEpochRewards(await helpers.getCurrentEpoch())).to.be.eq(expectedEpochRewards)
        });

        it('correctly accrues over multiple epoch', async function () {

            await helpers.moveAtEpoch(helpers.stakingEpochStart, helpers.stakingEpochDuration,2);
            let blockBefore = await interest.blockNumberLast();
            await interest.accrueInterest(10000,11000);
            let blockAfter = await interest.blockNumberLast();
            let blockDelta = blockAfter.sub(blockBefore)

            let interestsBase = (await interest.getInterestForReserve(10000,11000))
            let expectedEpochRewards = (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[0]
            .mul(blockDelta)

            expect(await interest.getEpochRewards(await helpers.getCurrentEpoch())).to.be.eq(expectedEpochRewards)
    
            //Move to next epoch
            await helpers.moveAtEpoch(helpers.stakingEpochStart, helpers.stakingEpochDuration,3);
            expect(await interest.getEpochRewards(await helpers.getCurrentEpoch())).to.be.eq(0)


            blockBefore = await interest.blockNumberLast()
            await interest.accrueInterest(10000,11000);
            blockAfter = await interest.blockNumberLast();
            let blockDelta2 = blockAfter.sub(blockBefore)

            interestsBase = (await interest.getInterestForReserve(10000,11000))
            expectedEpochRewards = (await interest.getNormalizedToBase(interestsBase[0],interestsBase[1]))[0]
            .mul(blockDelta2)

            expect(await interest.getEpochRewards(await helpers.getCurrentEpoch())).to.be.eq(expectedEpochRewards)
    

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