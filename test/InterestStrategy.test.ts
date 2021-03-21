import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { expect } from 'chai';
import { InterestStrategy } from '../typechain';
import * as deploy from './helpers/deploy';


describe('InterestStrategy', function () {

    let interest: InterestStrategy;

    before(async function () {

        interest = (await deploy.deployContract(
            'InterestStrategy', 
            [5,3])
            ) as InterestStrategy;
    });

    it("returns positive rate when reserves < taget", async () => {
        let rate = await interest.getInterestForReserve(1000,2000);
        expect(rate).to.gt(0);

      }); 
    it("returns offset when reserves == taget", async () => {
        let rate = await interest.getInterestForReserve(2000,2000);
        expect(rate).to.equal(5);
    }); 
    it("returns negative rate when reserves > taget", async () => {
        let rate = await interest.getInterestForReserve(2000,1000);
        expect(rate).to.lt(0);
    }); 

});