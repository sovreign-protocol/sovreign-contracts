pragma solidity 0.7.6;
import "./interfaces/IPoolController.sol";
import "./interfaces/IBasketBalancer.sol";
import "./interfaces/InterestStrategyInterface.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IOracle.sol";
import "./Pool.sol";
import "./InterestStrategy.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract PoolController is IPoolController {
    using SafeMath for uint256;

    address public override feeTo;
    address public basketBalancer;
    address public sovToken;
    address public reignToken;

    address public reignDAO;

    mapping(address => address) public override getPool;
    mapping(address => address) public override getInterestStrategy;
    mapping(address => address) public override getOracle;
    address[] public override allPools;

    event PairCreated(address indexed token, address pair, uint256);

    constructor(
        address _basketBalancer,
        address _sovToken,
        address _reignToken,
        address _reignDAO
    ) {
        basketBalancer = _basketBalancer;
        sovToken = _sovToken;
        reignToken = _reignToken;
        reignDAO = _reignDAO;
    }

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "SoV-Reign: Forbidden");
        _;
    }

    function allPoolsLength() external view override returns (uint256) {
        return allPools.length;
    }

    function createPool(address token)
        external
        override
        onlyDAO
        returns (address pool)
    {
        require(token != address(0), "SoV-Reign: ZERO_ADDRESS");
        require(getPool[token] == address(0), "SoV-Reign: POOL_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(Pool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token));
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IPool(pool).initialize(token, sovToken, reignToken);
        InterestStrategy interest = new InterestStrategy();

        getPool[token] = pool;
        getInterestStrategy[pool] = address(interest);
        allPools.push(address(pool));
        IBasketBalancer(basketBalancer).addPool(address(pool));

        emit PoolCreated(token, pool, allPools.length);

        return pool;
    }

    function setFeeTo(address _feeTo) external override onlyDAO {
        feeTo = _feeTo;
    }

    function setReignDAO(address _reignDAO) external override onlyDAO {
        reignDAO = _reignDAO;
    }

    function setBaseketBalancer(address _basketBalancer)
        external
        override
        onlyDAO
    {
        basketBalancer = _basketBalancer;
    }

    function setSovToken(address _sovToken) external override onlyDAO {
        sovToken = _sovToken;
    }

    function setReignToken(address _reignToken) external override onlyDAO {
        reignToken = _reignToken;
    }

    function setInterestStrategy(address strategy, address pool)
        external
        override
        onlyDAO
    {
        getInterestStrategy[pool] = strategy;
    }

    function setOracle(address oracle, address pool) external override onlyDAO {
        getOracle[pool] = oracle;
    }

    function getInterestRate(
        address pool,
        uint256 reserves,
        uint256 target
    ) external view override returns (uint256, uint256) {
        address strategy = getInterestStrategy[pool];
        return
            InterestStrategyInterface(strategy).getInterestForReserve(
                reserves,
                target
            );
    }

    function getTargetAllocation(address pool)
        external
        view
        override
        returns (uint256)
    {
        return IBasketBalancer(basketBalancer).getTargetAllocation(pool);
    }

    function getPoolsTVL() external view override returns (uint256) {
        uint256 tvl = 0;
        for (uint32 i = 0; i < allPools.length; i++) {
            IPool pool = IPool(allPools[i]);
            uint256 pool_size = pool.getReserves();
            address pool_token = pool.token();
            uint256 price = getTokenPrice(pool_token);
            uint256 pool_value = pool_size.mul(price);
            tvl = tvl.add(pool_value);
        }
        return tvl;
    }

    function isPool(address pool) public view override returns (bool) {
        for (uint32 i = 0; i < allPools.length; i++) {
            if (allPools[i] == pool) {
                return true;
            }
        }
        return false;
    }

    function getTokenPrice(address pool_token)
        public
        view
        override
        returns (uint256)
    {
        // TODO: oracle?
        return IOracle(getOracle[pool_token]).consult(pool_token, 10**18);
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
