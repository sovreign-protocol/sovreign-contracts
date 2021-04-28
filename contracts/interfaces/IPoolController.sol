// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

interface IPoolController {
    event PoolCreated(address indexed token, address pool, uint256);

    function createPool(
        address,
        address,
        address
    ) external returns (address pool);

    function setInterestStrategy(address, address) external;

    function setOracle(address, address) external;

    function setTreasoury(address) external;

    function setReignDAO(address) external;

    function setBaseketBalancer(address) external;

    function setSvrToken(address) external;

    function setReignToken(address) external;

    function getPool(address) external view returns (address);

    function getInterestStrategy(address) external view returns (address);

    function getOracle(address) external view returns (address);

    function allPools(uint256) external view returns (address);

    function isPool(address) external view returns (bool);

    function allPoolsLength() external view returns (uint256);

    function getPoolsTVL() external view returns (uint256);

    function getTokenPrice(address) external view returns (uint256);

    function getReignPrice() external view returns (uint256);

    function getTargetSize(address) external view returns (uint256);

    function getTargetAllocation(address) external view returns (uint256);
}
