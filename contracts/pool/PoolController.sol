// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
import "../interfaces/IPoolController.sol";
import "../interfaces/IBasketBalancer.sol";
import "../interfaces/InterestStrategyInterface.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IOracle.sol";
import "./Pool.sol";
import "../periphery/InterestStrategy.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract PoolController is IPoolController {
    using SafeMath for uint256;

    address public basketBalancer;
    address public svrToken;
    address public reignToken;
    address public treasoury;

    address public reignDAO;

    mapping(address => address) public override getPool;
    mapping(address => address) public override getInterestStrategy;
    mapping(address => address) public override getOracle;
    address[] public override allPools;

    event PairCreated(address indexed token, address pair, uint256);

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "SoV-Reign: FORBIDDEN");
        _;
    }

    constructor(
        address _basketBalancer,
        address _svrToken,
        address _reignToken,
        address _reignDAO,
        address _treasoury
    ) {
        basketBalancer = _basketBalancer;
        svrToken = _svrToken;
        reignToken = _reignToken;
        reignDAO = _reignDAO;
        treasoury = _treasoury;
    }

    function createPool(
        address token,
        address interestStrategy,
        address oracle
    ) external override onlyDAO returns (address pool) {
        require(token != address(0), "SoV-Reign: ZERO_ADDRESS");
        require(interestStrategy != address(0), "SoV-Reign: ZERO_ADDRESS");
        require(oracle != address(0), "SoV-Reign: ZERO_ADDRESS");

        require(getPool[token] == address(0), "SoV-Reign: POOL_EXISTS"); // single check is sufficient

        bytes memory bytecode = type(Pool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token));

        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IPool(pool).initialize(token, treasoury, svrToken, reignToken);

        getPool[token] = pool;
        getInterestStrategy[pool] = interestStrategy;
        getOracle[pool] = oracle;
        allPools.push(address(pool));
        IBasketBalancer(basketBalancer).addPool(address(pool));

        emit PoolCreated(token, pool, allPools.length);

        return pool;
    }

    function setTreasoury(address _treasoury) external override onlyDAO {
        require(_treasoury != address(0), "SoV-Reign: ZERO_ADDRESS");
        treasoury = _treasoury;
    }

    function setReignDAO(address _reignDAO) external override onlyDAO {
        require(_reignDAO != address(0), "SoV-Reign: ZERO_ADDRESS");
        reignDAO = _reignDAO;
    }

    function setBaseketBalancer(address _basketBalancer)
        external
        override
        onlyDAO
    {
        require(_basketBalancer != address(0), "SoV-Reign: ZERO_ADDRESS");
        basketBalancer = _basketBalancer;
    }

    function setSvrToken(address _svrToken) external override onlyDAO {
        require(_svrToken != address(0), "SoV-Reign: ZERO_ADDRESS");
        svrToken = _svrToken;
    }

    function setReignToken(address _reignToken) external override onlyDAO {
        require(_reignToken != address(0), "SoV-Reign: ZERO_ADDRESS");
        reignToken = _reignToken;
    }

    function setInterestStrategy(address strategy, address pool)
        external
        override
        onlyDAO
    {
        require(strategy != address(0), "SoV-Reign: ZERO_ADDRESS");
        getInterestStrategy[pool] = strategy;
    }

    function setOracle(address oracle, address pool) external override onlyDAO {
        require(oracle != address(0), "SoV-Reign: ZERO_ADDRESS");
        getOracle[pool] = oracle;
    }

    function allPoolsLength() external view override returns (uint256) {
        return allPools.length;
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

    function getTargetSize(address pool)
        external
        view
        override
        returns (uint256)
    {
        uint256 allocation =
            IBasketBalancer(basketBalancer).getTargetAllocation(pool);
        uint256 tvl = getPoolsTVL();
        uint256 targetValue = tvl.mul(allocation).div(1000000).mul(10**18);
        uint256 targetSize = targetValue.div(getTokenPrice(pool));
        return targetSize;
    }

    function getTokenPrice(address pool)
        public
        view
        override
        returns (uint256)
    {
        //returns the amount in USDC recived for paying in 1 token, i.e the USD price of 1 token
        address pool_token = IPool(pool).token();
        return IOracle(getOracle[pool]).consult(pool_token, 10**18);
    }

    function getPoolsTVL() public view override returns (uint256) {
        uint256 tvl = 0;
        for (uint32 i = 0; i < allPools.length; i++) {
            IPool pool = IPool(allPools[i]);
            uint256 pool_size = pool.getReserves();
            uint256 price = getTokenPrice(allPools[i]);
            uint256 pool_value = pool_size.mul(price);
            tvl = tvl.add(pool_value.div(10**18));
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

    function getReignPrice() external view override returns (uint256) {
        uint256 reign_price =
            IOracle(getOracle[allPools[0]]).consult(reignToken, 10**18);

        return reign_price;
    }
}
