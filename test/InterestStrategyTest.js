const { BN, constants, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const InterestStrategyMock = artifacts.require('InterestStrategy');

contract("InterestStrategy", async accounts => {

    it("return interest rate", async () => {
        let instance = await InterestStrategyMock.deployed(5,1);
        let interest = await instance.getInterestForReserve.call(1000,2000);
        assert.equals(interets > 0, true);
      });

});