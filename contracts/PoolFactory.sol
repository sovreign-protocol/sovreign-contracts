pragma solidity 0.7.6;
import "./interfaces/IPoolFactory.sol";
import "./interfaces/IBasketBalancer.sol";
import "./interfaces/InterestStrategyInterface.sol";
import "./interfaces/IPool.sol";
import "./Pool.sol";
import "./InterestStrategy.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract PoolFactory is IPoolFactory {
    using SafeMath for uint256;

    address public override feeTo;
    address public override feeToSetter;
    address public basketBalacer;
    address public sovToken;
    address public reignToken;

    mapping(address => address) public override getPool;
    mapping(address => address) public override getInterestStrategy;
    address[] public override allPools;

    event PairCreated(address indexed token, address pair, uint256);

    constructor(address _feeToSetter) public {
        feeToSetter = _feeToSetter;
    }

    function allPoolsLength() external view override returns (uint256) {
        return allPools.length;
    }

    function createPool(address token)
        external
        override
        returns (address pool)
    {
        require(token != address(0), "UniswapV2: ZERO_ADDRESS");
        require(getPool[token] == address(0), "UniswapV2: POOL_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(Pool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token));
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IPool(pool).initialize(token, sovToken, reignToken);
        InterestStrategy interest = new InterestStrategy();

        getPool[token] = pool;
        getInterestStrategy[pool] = address(interest);
        allPools.push(pool);

        emit PoolCreated(token, pool, allPools.length);
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setInterestStrategy(address strategy, address pool)
        external
        override
    {
        getInterestStrategy[pool] = strategy;
    }

    function getInterestRate(
        address pool,
        uint256 reserves,
        uint256 target
    ) external view override returns (uint256, uint256) {
        address strategy = getInterestStrategy[pool];
        return
            InterestStrategyInterface(basketBalacer).getInterestForReserve(
                reserves,
                target
            );
    }

    function setFeeToSetter(address _feeToSetter) external override {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    function getTargetAllocation(address pool)
        external
        view
        override
        returns (uint256)
    {
        return IBasketBalancer(basketBalacer).getTargetAllocation(pool);
    }

    function getPoolsTVL() external view override returns (uint256) {
        uint256 tvl = 0;
        for (uint32 i = 0; i < allPools.length; i++) {
            IPool pool = IPool(getPool[allPools[i]]);
            uint256 pool_size = pool.getReserves();
            address pool_token = pool.token();
            uint256 price = getTokenPrice(pool_token);
            uint256 pool_value = pool_size.mul(price);
            tvl = tvl.add(pool_value);
        }
        return tvl;
    }

    function getTokenPrice(address pool_token)
        public
        view
        override
        returns (uint256)
    {
        // TODO: oracle?
        return 1;
    }

    function getReignRate(address pool)
        external
        view
        override
        returns (uint256)
    {
        return 1;
    }
}
