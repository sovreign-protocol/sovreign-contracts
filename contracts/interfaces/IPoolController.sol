// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

interface IPoolController {
    event PoolCreated(address indexed token, address pool, uint256);

    function createPool(
        address token,
        address interestStrategy,
        address oracle
    ) external returns (address pool);

    function feeTo() external view returns (address);

    function setFeeTo(address) external;

    function setInterestStrategy(address, address) external;

    function setOracle(address, address) external;

    function setReignDAO(address _reignDAO) external;

    function setBaseketBalancer(address _basketBalancer) external;

    function setSovToken(address _sovToken) external;

    function setReignToken(address _reignToken) external;

    function getPool(address token) external view returns (address pool);

    function getInterestStrategy(address token)
        external
        view
        returns (address pool);

    function getOracle(address token) external view returns (address oracle);

    function allPools(uint256) external view returns (address pool);

    function isPool(address) external view returns (bool);

    function allPoolsLength() external view returns (uint256);

    function getPoolsTVL() external view returns (uint256);

    function getTokenPrice(address) external view returns (uint256);

    function getReignRate(address) external view returns (uint256);

    function getTargetSize(address) external view returns (uint256);

    function getInterestRate(
        address,
        uint256,
        uint256
    ) external view returns (uint256, uint256);
}
