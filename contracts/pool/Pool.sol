// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "./PoolErc20.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IMintBurnErc20.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IPoolController.sol";
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
    address public override svrToken;
    address public override reignToken;
    address public override treasoury;

    uint256 private reserve; // uses single storage slot, accessible via getReserves
    uint256 public BASE_MULTIPLIER = 10**18;
    uint256 public depositFeeMultiplier = 100000;
    uint256 public withdrawFeeMultiplier;
    uint256 public interestRateLast;
    uint256 public blockNumberLast;

    uint256 private unlocked = 1;

    uint256 public BASE_SVR_AMOUNT = 10000 * 10**18;

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

    function _safeTransfer(address to, uint256 value) private {
        IERC20(token).transfer(to, value);
    }

    constructor() {
        controllerAddress = msg.sender;
    }

    // called once by the controller at time of deployment
    function initialize(
        address _token,
        address _tresoury,
        address _svr,
        address _reign
    ) external override {
        require(msg.sender == controllerAddress, "UniswapV2: FORBIDDEN"); // sufficient check
        token = _token;
        treasoury = _tresoury;
        svrToken = _svr;
        reignToken = _reign;
        controller = IPoolController(msg.sender);
    }

    // update reserves and, on the first call per block
    function _updateReserves() private {
        address _token = token;
        reserve = IERC20(_token).balanceOf(address(this));
        emit Sync(reserve);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to)
        external
        override
        lock
        returns (uint256 liquidity)
    {
        uint256 _reserve = getReserves(); // gas savings
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amount = balance.sub(_reserve);

        uint256 depositFee = getDepositFeeReign(amount);

        if (depositFee > 0) {
            IMintBurnErc20 reign = IMintBurnErc20(reignToken);

            require(amount > 0, "Can only issue positive amounts");

            require(
                reign.allowance(msg.sender, address(this)) >= depositFee,
                "Insufficient allowance"
            );
            uint256 toTreasoury = depositFee.div(2);
            reign.transferFrom(msg.sender, treasoury, toTreasoury);
            reign.burnFrom(msg.sender, depositFee.sub(toTreasoury));
        }

        //bool feeOn = _takeFeeIn(amount);
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

        _updateReserves();

        _accrueInterest();

        _mintSvr(to, amount);
    }

    function burn(uint256 amount) external override lock returns (bool) {
        require(amount > 0, "Can only burn positive amounts");

        address _token = token; // gas savings
        address to = msg.sender;

        uint256 withdrawFee = getWithdrawFeeReign(amount);

        if (withdrawFee > 0) {
            IMintBurnErc20 reign = IMintBurnErc20(reignToken);

            require(
                reign.allowance(msg.sender, address(this)) >= withdrawFee,
                "Insufficient allowance"
            );
            uint256 toTreasoury = withdrawFee.div(2);
            reign.transferFrom(msg.sender, treasoury, toTreasoury);
            reign.burnFrom(msg.sender, withdrawFee.sub(toTreasoury));
        }

        //Burn LP tokens
        _burn(msg.sender, amount);
        //Withdraw only with interest applied
        IERC20(_token).transfer(to, amount);

        _burnSvr(to, amount);

        _updateReserves();

        _accrueInterest();
    }

    // force balances to match reserves
    function skim(address to) external override lock {
        address _token = token; // gas savings
        IERC20(token).transfer(
            to,
            IERC20(_token).balanceOf(address(this)).sub(reserve)
        );
    }

    function getDepositFeeReign(uint256 amount) public view returns (uint256) {
        uint256 target = controller.getTargetSize(address(this));

        if (target == 0 || reserve == 0) {
            return 0;
        }

        (uint256 _, uint256 interestRate) =
            controller.getInterestRate(
                address(this),
                reserve.add(amount),
                target
            );
        return
            (
                interestRate
                    .mul(depositFeeMultiplier)
                    .mul(amount)
                    .mul(controller.getTokenPrice(address(this)))
                    .div(controller.getReignPrice())
            )
                .div(10**18);
    }

    function getWithdrawFeeReign(uint256 amount) public view returns (uint256) {
        return
            (
                withdrawFeeMultiplier
                    .mul(amount)
                    .mul(controller.getTokenPrice(address(this)))
                    .div(controller.getReignPrice())
            )
                .div(10**18);
    }

    // force reserves to match balances
    function sync() external override lock {
        _updateReserves();
    }

    function _mintSvr(address to, uint256 amount) private returns (bool) {
        uint256 svrSupply = IMintBurnErc20(svrToken).totalSupply();
        uint256 TVL = controller.getPoolsTVL();
        uint256 price = controller.getTokenPrice(address(this));
        uint256 amountSvr;
        if (svrSupply == 0) {
            amountSvr = BASE_SVR_AMOUNT;
        } else {
            amountSvr = amount.mul(price).mul(svrSupply).div(TVL).div(10**18);
        }

        emit Mint(msg.sender, amount, amountSvr);

        return IMintBurnErc20(svrToken).mint(to, amountSvr);
    }

    function _burnSvr(address from, uint256 amount) private returns (bool) {
        uint256 svrSupply = IMintBurnErc20(svrToken).totalSupply();
        uint256 TVL = controller.getPoolsTVL();
        uint256 price = controller.getTokenPrice(address(this));
        uint256 amountSvr =
            amount.mul(price).mul(svrSupply).div(TVL).div(10**18);

        emit Burn(msg.sender, amount, amountSvr);

        return IMintBurnErc20(svrToken).burnFrom(from, amountSvr);
    }

    function _accrueInterest() public returns (bool) {
        uint256 _currentBlockNumber = block.number;
        uint256 _accrualBlockNumberPrior = blockNumberLast;

        if (_accrualBlockNumberPrior == _currentBlockNumber) {
            return false;
        }

        if (totalSupply == 0) {
            blockNumberLast = _currentBlockNumber;
            return false;
        }

        uint256 _reserves = getReserves();
        uint256 _target = controller.getTargetSize(address(this));

        (uint256 _, uint256 _interestRate) =
            controller.getInterestRate(address(this), _reserves, _target);

        // Calculate the number of blocks elapsed since the last accrual
        uint256 _blockDelta = _currentBlockNumber.sub(_accrualBlockNumberPrior);

        uint256 _accumulatedInterest = _interestRate.mul(_blockDelta);
        if (_interestRate == 0) {
            withdrawFeeMultiplier = 0;
        } else if (_interestRate > interestRateLast) {
            withdrawFeeMultiplier = withdrawFeeMultiplier.add(
                _accumulatedInterest
            );
        } else if (_interestRate < interestRateLast) {
            if (withdrawFeeMultiplier > _accumulatedInterest) {
                withdrawFeeMultiplier = withdrawFeeMultiplier.sub(
                    _accumulatedInterest
                );
            } else {
                withdrawFeeMultiplier = 0;
            }
        } // if interest is the same as last do not change it

        blockNumberLast = _currentBlockNumber;
        interestRateLast = _interestRate;

        emit AccrueInterest(depositFeeMultiplier, withdrawFeeMultiplier);

        return true;
    }

    function setFeeIn(uint256 feeInNew) external override {
        feeIn = feeInNew;
    }

    function setFeeOut(uint256 feeOutNew) external override {
        feeOut = feeOutNew;
    }
}
