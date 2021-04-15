import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import { InterestStrategy } from '../typechain';
import * as deploy from './helpers/deploy';
import * as helpers from './helpers/helpers';


describe('InterestStrategy', function () {

    let interest: InterestStrategy;

    let multiplier = BigNumber.from(3).mul(10**10);
    let offset     = BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59)));


    before(async function () {

        interest = (await deploy.deployContract(
            'InterestStrategy',[multiplier, offset])
            ) as InterestStrategy;
    });

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


    it("returns correct values for mock inputs 1", async () => {

        let reserves = BigNumber.from(980000).mul(helpers.tenPow18);
        let target   = BigNumber.from(1000000).mul(helpers.tenPow18);

        let delta = await interest.getDelta(reserves,target);
        let rates = await interest.getInterestForReserve(reserves,target);

        expect(rates[0]).to.equal(914155251141);
        expect(rates[1]).to.equal(0);
    }); 

});