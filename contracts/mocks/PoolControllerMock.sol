// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

contract PoolControllerMock {
    address interest;
    uint256 adjustment;

    constructor(address _int, uint256 _adj) {
        interest = _int;
        adjustment = _adj;
    }

    function getInterestStrategy(address _pool) public view returns (address) {
        return interest;
    }

    function getTargetAllocation(address _pool) public view returns (uint256) {
        return 500000000;
    }

    function getAdjustment(address _pool) public view returns (uint256) {
        return adjustment;
    }
}
