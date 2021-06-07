// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

contract EpochClockMock {
    uint256 start;
    uint256 duration = 604800;

    constructor(uint256 _start) {
        start = _start;
    }

    function getEpochDuration() external view returns (uint256) {
        return duration;
    }

    function getEpoch1Start() external view returns (uint256) {
        return start;
    }
}
