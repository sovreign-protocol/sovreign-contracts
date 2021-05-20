// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

interface IPoolController {
    function createPool(
        address,
        address,
        address
    ) external returns (address pool);

    function setInterestStrategy(address, address) external;

    function setOracle(address, address) external;

    function setReignDAO(address) external;

    function setBaseketBalancer(address) external;

    function setSvrToken(address) external;

    function setReignToken(address) external;

    function setDepositFeeMultiplier(uint256) external;

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

    function depositFeeMultiplier() external view returns (uint256);

    function reignDAO() external view returns (address);

    function liquidityBuffer() external view returns (address);

    function svrToken() external view returns (address);

    function reignToken() external view returns (address);

    function getBasketBalancer() external view returns (address);
}
