// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IEpochClock.sol";

contract EpochClockMock is IEpochClock {
    uint256 start;

    constructor(uint256 _start) {
        start = _start;
    }

    function getEpochDuration() external pure override returns (uint256) {
        return 604800;
    }

    function getEpoch1Start() external view override returns (uint256) {
        return start;
    }

    function getCurrentEpoch() external view override returns (uint128) {
        if (block.timestamp < start) {
            return 0;
        }
        return uint128((block.timestamp - start) / 604800 + 1);
    }
}
