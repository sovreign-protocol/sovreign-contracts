const { BN, constants, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { assert } = require('chai');
const { ZERO_ADDRESS } = constants;

const InterestStrategyMock = artifacts.require('InterestStrategy');

contract("InterestStrategy", async accounts => {

    it("returns positive rate when reserves < taget", async () => {
        let instance = await InterestStrategyMock.deployed(5,1);
        let interest = await instance.getInterestForReserve.call(1000,2000);
        assert.isTrue(interest > 0);

      }); 
    it("returns offset when reserves == taget", async () => {
        let instance = await InterestStrategyMock.deployed(5,1);
        let interest = await instance.getInterestForReserve.call(2000,2000);
        assert.equal(interest, 5);
    }); 
    it("returns negative rate when reserves > taget", async () => {
        let instance = await InterestStrategyMock.deployed(5,1);
        let interest = await instance.getInterestForReserve.call(2000,1000);
        assert.isTrue(interest < 0);
    }); 

});