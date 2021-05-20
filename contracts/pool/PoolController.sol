// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
import "../interfaces/IPoolController.sol";
import "../interfaces/IBasketBalancer.sol";
import "../interfaces/InterestStrategyInterface.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IEpochClock.sol";
import "./Pool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract PoolController is IPoolController {
    using SafeMath for uint256;

    IBasketBalancer private basketBalancer;
    IEpochClock private clock;
    address public override svrToken;
    address public override reignToken;
    address public override reignDAO;
    address public override liquidityBuffer;
    uint256 public override depositFeeMultiplier;
    address public reignTokenOracle;

    mapping(address => address) public override getPool;
    mapping(address => address) public override getInterestStrategy;
    mapping(address => address) public override getOracle;
    address[] public override allPools;

    event PoolCreated(
        address indexed token,
        address indexed pair,
        uint256 indexed id
    );

    modifier onlyDAO() {
        require(msg.sender == reignDAO, "SoVReign: FORBIDDEN");
        _;
    }

    constructor(
        address _basketBalancer,
        address _svrToken,
        address _reignToken,
        address _reignTokenOracle,
        address _reignDAO,
        address _reignDiamond,
        address _liquidityBuffer
    ) {
        basketBalancer = IBasketBalancer(_basketBalancer);
        svrToken = _svrToken;
        reignTokenOracle = _reignTokenOracle;
        reignToken = _reignToken;
        reignDAO = _reignDAO;
        clock = IEpochClock(_reignDiamond);
        liquidityBuffer = _liquidityBuffer;
    }

    function createPool(
        address underlyingToken,
        address interestStrategy,
        address oracle
    ) external override onlyDAO returns (address pool) {
        require(underlyingToken != address(0), "SoVReign: ZERO_ADDRESS");
        require(interestStrategy != address(0), "SoVReign: ZERO_ADDRESS");
        require(oracle != address(0), "SoVReign: ZERO_ADDRESS");

        require(
            IOracle(oracle).owner_address() == reignDAO,
            "Oracle needs to be governed by DAO"
        );

        require(
            getPool[underlyingToken] == address(0),
            "SoVReign: POOL_EXISTS"
        ); // single check is sufficient

        bytes memory bytecode = type(Pool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(underlyingToken));

        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IPool(pool).initialize(underlyingToken);
        InterestStrategyInterface(interestStrategy).initialize(
            pool,
            reignDAO,
            clock.getEpoch1Start(),
            clock.getEpochDuration()
        );

        getPool[underlyingToken] = pool;
        getInterestStrategy[pool] = interestStrategy;
        getOracle[pool] = oracle;
        allPools.push(address(pool));
        basketBalancer.addPool(address(pool));

        emit PoolCreated(underlyingToken, pool, allPools.length);

        return pool;
    }

    /**
        SETTERS
     */

    function setReignDAO(address _reignDAO) external override onlyDAO {
        require(_reignDAO != address(0), "SoVReign: ZERO_ADDRESS");
        reignDAO = _reignDAO;
    }

    function setBaseketBalancer(address _basketBalancer)
        external
        override
        onlyDAO
    {
        require(_basketBalancer != address(0), "SoVReign: ZERO_ADDRESS");
        basketBalancer = IBasketBalancer(_basketBalancer);
    }

    function setSvrToken(address _svrToken) external override onlyDAO {
        require(_svrToken != address(0), "SoVReign: ZERO_ADDRESS");
        svrToken = _svrToken;
    }

    function setReignToken(address _reignToken) external override onlyDAO {
        require(_reignToken != address(0), "SoVReign: ZERO_ADDRESS");
        reignToken = _reignToken;
    }

    function setReignTokenOracle(address _reignTokenOracle) external onlyDAO {
        require(_reignTokenOracle != address(0), "SoVReign: ZERO_ADDRESS");
        reignTokenOracle = _reignTokenOracle;
    }

    function setInterestStrategy(address strategy, address pool)
        external
        override
        onlyDAO
    {
        require(strategy != address(0), "SoVReign: ZERO_ADDRESS");
        getInterestStrategy[pool] = strategy;
    }

    function setOracle(address oracle, address pool) external override onlyDAO {
        require(oracle != address(0), "SoVReign: ZERO_ADDRESS");
        getOracle[pool] = oracle;
    }

    function setDepositFeeMultiplier(uint256 newValue)
        external
        override
        onlyDAO
    {
        depositFeeMultiplier = newValue;
    }

    /**
        VIEWS
     */

    function allPoolsLength() external view override returns (uint256) {
        return allPools.length;
    }

    // returns the target size of the pool denominated in underlying pool token
    function getTargetSize(address pool)
        external
        view
        override
        returns (uint256)
    {
        uint256 allocation = basketBalancer.getTargetAllocation(pool);
        uint256 fullAllocation = basketBalancer.FULL_ALLOCATION();
        uint256 tvl = getPoolsTVL();
        uint256 targetValue = tvl.mul(allocation).div(fullAllocation);
        uint256 targetSize =
            targetValue.mul(10**IPool(pool).tokenDecimals()).div(
                getTokenPrice(pool)
            );
        return targetSize;
    }

    function getTargetAllocation(address pool)
        external
        view
        override
        returns (uint256)
    {
        return basketBalancer.getTargetAllocation(pool);
    }

    // returns the total price of the poool token denominated in usdc (6 decimals)
    function getTokenPrice(address pool)
        public
        view
        override
        returns (uint256)
    {
        //returns the amount in USDC recived for paying in 1 underlyingToken, i.e the USD price of 1 underlyingToken
        address pool_token = IPool(pool).token();
        uint256 _decimals = IERC20(pool_token).decimals();
        return IOracle(getOracle[pool]).consult(pool_token, 1 * 10**_decimals);
    }

    // retusrns the total value locked across al pools denominated in usdc (6 decimals)
    function getPoolsTVL() public view override returns (uint256) {
        uint256 tvl = 0;
        for (uint32 i = 0; i < allPools.length; i++) {
            IPool pool = IPool(allPools[i]);
            uint256 pool_size = pool.getReserves();
            uint256 price = getTokenPrice(allPools[i]);
            uint256 pool_value =
                pool_size.mul(price).div(10**pool.tokenDecimals());
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

    function getReignPrice() external view override returns (uint256) {
        uint256 reign_price =
            IOracle(reignTokenOracle).consult(reignToken, 10**18);

        return reign_price;
    }

    function getBasketBalancer() external view override returns (address) {
        return address(basketBalancer);
    }
}
