pragma solidity 0.7.6;

interface IPoolFactory {
    event PoolCreated(address indexed token, address pool, uint256);

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function getPool(address token) external view returns (address pool);

    function getInterestStrategy(address token)
        external
        view
        returns (address pool);

    function allPools(uint256) external view returns (address pool);

    function allPoolsLength() external view returns (uint256);

    function getPoolsTVL() external view returns (uint256);

    function getTokenPrice(address) external view returns (uint256);

    function getReignRate(address) external view returns (uint256);

    function getTargetAllocation(address) external view returns (uint256);

    function getInterestRate(
        address,
        uint256,
        uint256
    ) external view returns (uint256, uint256);

    function createPool(address token) external returns (address pool);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;

    function setInterestStrategy(address, address) external;
}
