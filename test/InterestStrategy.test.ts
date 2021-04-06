import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import { InterestStrategy } from '../typechain';
import * as deploy from './helpers/deploy';
import * as helpers from './helpers/helpers';


describe('InterestStrategy', function () {

    let interest: InterestStrategy;

    before(async function () {

        interest = (await deploy.deployContract(
            'InterestStrategy')
            ) as InterestStrategy;
    });

    it("returns positive rate when reserves < taget", async () => {
        let rates = await interest.getInterestForReserve(1000,2000);
        expect(rates[0]).to.gt(0);
        expect(rates[1]).to.equal(0);

      }); 
    it("returns offset when reserves == taget", async () => {
        let rates = await interest.getInterestForReserve(2000,2000);
        let offset = await interest.getOffsett();
        expect(rates[0]).to.equal(200000000000);
    }); 
    it("returns negative rates when reserves > taget", async () => {
        let rates = await interest.getInterestForReserve(2000,1000);
        expect(rates[0]).to.equal(0);
        expect(rates[1]).to.gt(0);
    }); 


    it("returns for large numbers", async () => {

        let amount1 = BigNumber.from(1400000000000000).mul(helpers.tenPow18); // 1.4 * 10**33
        let amount2 = BigNumber.from(700000000000000).mul(helpers.tenPow18);

        let rates = await interest.getInterestForReserve(amount1,amount2);
        expect(rates[0]).to.equal(0);
        expect(rates[1]).to.gt(0);
    }); 

    it("returns delta correctly", async () => {

        let amount1 = BigNumber.from(1400000).mul(helpers.tenPow18);
        let amount2 = BigNumber.from(700000).mul(helpers.tenPow18);

        let delta = await interest.getDelta(amount1,amount2);
        let expected = (amount2.sub(amount1)).div(amount2)

        expect(delta).to.eq(expected.mul(helpers.tenPow18))
    }); 

});