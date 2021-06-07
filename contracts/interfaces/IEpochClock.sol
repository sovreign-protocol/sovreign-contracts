// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface IEpochClock {
    function getEpochDuration() external view returns (uint256);

    function getEpoch1Start() external view returns (uint256);

    function getCurrentEpoch() external view returns (uint128);
}
