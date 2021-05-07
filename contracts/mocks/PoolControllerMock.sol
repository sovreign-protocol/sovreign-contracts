// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

contract PoolControllerMock {
    address interest;
    address balancer;
    bool isPoolVal = true;

    constructor(address _int, address _balancer) {
        interest = _int;
        balancer = _balancer;
    }

    function getInterestStrategy(address _pool) public view returns (address) {
        return interest;
    }

    function getTargetAllocation(address _pool) public view returns (uint256) {
        return 500000000;
    }

    function getBasketBalancer() public view returns (address) {
        return balancer;
    }

    function isPool(address _pool) public view returns (bool) {
        return isPoolVal;
    }

    function setIsPool(bool val) public {
        isPoolVal = val;
    }
}
