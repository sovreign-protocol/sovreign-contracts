pragma solidity 0.7.6;

import "./PoolErc20.sol";
import "./libraries/Math.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IMintBurnErc20.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolController.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Pool is IPool, PoolErc20 {
    using SafeMath for uint256;

    uint256 public constant override MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR =
        bytes4(keccak256(bytes("transfer(address,uint256)")));

    // premium to be paid to incentivized to tak take our
    // REIGN instead of going to secondary market
    uint256 public override premiumFactor = 11 * 10**17;
    uint256 public override feeIn = 2 * 10**15;
    uint256 public override feeOut = 2 * 10**15;

    address public override controllerAddress;
    address public override token;
    address public override sovToken;
    address public override reignToken;

    uint256 private reserve; // uses single storage slot, accessible via getReserves
    uint256 public excessLiquidity;
    uint256 public interestMultiplier;
    uint256 private blockNumberLast; // uses single storage slot, accessible via getReserves

    uint256 private unlocked = 1;

    uint256 BASE_AMOUNT = 10000 * 10**18;

    IPoolController controller;

    modifier lock() {
        require(unlocked == 1, "UniswapV2: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function getReserves() public view override returns (uint256 _reserve) {
        _reserve = reserve;
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "UniswapV2: TRANSFER_FAILED"
        );
    }

    constructor() public {
        controllerAddress = msg.sender;
    }

    // called once by the controller at time of deployment
    function initialize(
        address _token,
        address _sov,
        address _reign
    ) external override {
        require(msg.sender == controllerAddress, "UniswapV2: FORBIDDEN"); // sufficient check
        token = _token;
        sovToken = _sov;
        reignToken = _reign;
        controller = IPoolController(msg.sender);
    }

    // update reserves and, on the first call per block
    function _updateReserves(uint256 balance) private {
        require(balance <= uint256(-1), "UniswapV2: OVERFLOW");
        reserve = uint256(balance);
        blockNumberLast = block.number;
        emit Sync(reserve);
    }

    function _takeFeeIn(uint256 amount) private returns (bool feeOn) {
        //TODO
        return true;
    }

    function _takeFeeOut(uint256 amount) private returns (bool feeOn) {
        //TODO
        return true;
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to)
        external
        override
        lock
        returns (uint256 liquidity)
    {
        _accrueInterest();

        uint256 _reserve = getReserves(); // gas savings
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amount = balance.sub(_reserve);

        require(amount > 0, "Can only issue positive amounts");

        bool feeOn = _takeFeeIn(amount);
        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = amount.sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = amount;
        }
        require(liquidity > 0, "UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED");
        //Mint LP Tokens
        _mint(to, liquidity);
        _updateReserves(balance);

        _mintSov(to, amount);
    }

    function burn(address to)
        external
        override
        lock
        returns (uint256 amountSov)
    {
        _accrueInterest();

        uint256 _reserve = getReserves(); // gas savings
        address _token = token; // gas savings
        address _sovToken = sovToken; // gas savings
        uint256 sovToBurn = controller.getPoolsTVL();
        uint256 amount = balanceOf[address(this)];

        bool feeOn = _takeFeeOut(amount);
        uint256 amountWithInterest =
            (amount.mul(interestMultiplier)).div(10**18);
        require(amount > 0, "UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED");
        //Burn LP tokens
        _burn(address(this), amount);
        //Withdraw only with interest applied
        _safeTransfer(_token, to, amountWithInterest);
        uint256 balance = IERC20(_token).balanceOf(address(this));
        _updateReserves(balance);

        _burnSov(to, amount);
    }

    // force balances to match reserves
    function skim(address to) external override lock {
        address _token = token; // gas savings
        _safeTransfer(
            _token,
            to,
            IERC20(_token).balanceOf(address(this)).sub(reserve)
        );
    }

    function redeem(address to, uint256 amountReign) external override lock {
        _accrueInterest();

        require(
            IMintBurnErc20(reignToken).balanceOf(msg.sender) > amountReign,
            "insufficient balance"
        );

        address _token = token;
        uint256 reignToTokenRate = controller.getReignRate(address(this));

        uint256 amount =
            amountReign.mul(reignToTokenRate).mul(premiumFactor).div(10**36);

        require(excessLiquidity > amount, "insufficient excess liquidty");

        excessLiquidity = excessLiquidity.sub(amount);

        IMintBurnErc20(reignToken).burnFrom(to, amountReign);
        _safeTransfer(_token, to, amount);

        uint256 balance = IERC20(_token).balanceOf(address(this));
        _updateReserves(balance);
    }

    // force reserves to match balances
    function sync() external override lock {
        _updateReserves(IERC20(token).balanceOf(address(this)));
    }

    function _mintSov(address to, uint256 amount) private returns (bool) {
        uint256 sovSupply = IMintBurnErc20(sovToken).totalSupply();
        uint256 TVL = controller.getPoolsTVL();
        uint256 price = controller.getTokenPrice(address(this));
        uint256 amountSov;
        if (sovSupply == 0) {
            amountSov = BASE_AMOUNT;
        } else {
            amountSov = amount.mul(price).mul(sovSupply) / TVL;
        }

        emit Mint(msg.sender, amount, amountSov);

        return IMintBurnErc20(sovToken).mint(to, amountSov);
    }

    function _burnSov(address from, uint256 amount) private returns (bool) {
        uint256 sovSupply = IMintBurnErc20(sovToken).totalSupply();
        uint256 TVL = controller.getPoolsTVL();
        uint256 price = controller.getTokenPrice(address(this));
        uint256 amountSov = amount.mul(price).mul(sovSupply) / TVL;

        emit Burn(msg.sender, amount, amountSov);

        return IMintBurnErc20(sovToken).burnFrom(from, amountSov);
    }

    function _accrueInterest() private returns (bool) {
        uint256 currentBlockNumber = block.number;
        uint256 accrualBlockNumberPrior = blockNumberLast;

        if (accrualBlockNumberPrior == currentBlockNumber) {
            return false;
        }

        if (totalSupply == 0) {
            blockNumberLast = currentBlockNumber;
            return false;
        }

        uint256 reserves = getReserves();
        uint256 target = controller.getTargetAllocation(address(this));

        (uint256 _, uint256 interestRate) =
            controller.getInterestRate(address(this), reserve, target);

        // Calculate the number of blocks elapsed since the last accrual
        uint256 blockDelta = currentBlockNumber.sub(accrualBlockNumberPrior);

        // new = old * (1 - (interest % * blocks ))
        uint256 excessLiquidityNew =
            totalSupply.mul(interestRate.mul(blockDelta));

        blockNumberLast = currentBlockNumber;
        excessLiquidity = excessLiquidity + excessLiquidityNew;

        interestMultiplier = (totalSupply.mul(10**18).sub(excessLiquidity)).div(
            totalSupply
        );

        emit AccrueInterest(excessLiquidity, interestMultiplier);
    }

    function setFeeIn(uint256 feeInNew) external override {
        feeIn = feeInNew;
    }

    function setFeeOut(uint256 feeOutNew) external override {
        feeOut = feeOutNew;
    }

    function setPremiumFactor(uint256 premiumFactorNew) external override {
        premiumFactor = premiumFactorNew;
    }
}
