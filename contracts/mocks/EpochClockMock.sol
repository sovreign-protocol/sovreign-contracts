// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IEpochClock.sol";

contract EpochClockMock is IEpochClock {
    uint256 start;
    uint256 duration = 604800;

    constructor(uint256 _start) {
        start = _start;
    }

    function getEpochDuration() external view override returns (uint256) {
        return duration;
    }

    function getEpoch1Start() external view override returns (uint256) {
        return start;
    }

    function getCurrentEpoch() external view override returns (uint128) {
        if (block.timestamp < start) {
            return 0;
        }
        return uint128((block.timestamp - start) / duration + 1);
    }

    function getEpochStart() public view override returns (uint256) {
        if (block.timestamp < start) {
            return start;
        }
        uint256 _epcohId = (block.timestamp - start) / duration;

        return start + (_epcohId * duration);
    }
}
