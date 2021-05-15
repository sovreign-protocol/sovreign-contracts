// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "./PoolErc20.sol";
//import "../interfaces/IERC20.sol";
import "../interfaces/IMintBurnErc20.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IPoolController.sol";
import "../libraries/LibRewardsDistribution.sol";
import "../libraries/SafeERC20.sol";
import "../interfaces/InterestStrategyInterface.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "hardhat/console.sol";

contract Pool is IPool, PoolErc20, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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
    uint256 public override tokenDecimals;
    address public override svrToken;
    address public override reignToken;
    address public override treasury;
    address public override liquidityBuffer;

    uint256 private reserve;
    uint256 public BASE_MULTIPLIER = 10**18;
    uint256 public depositFeeMultiplier = 100000;

    uint256 private unlocked = 1;

    uint256 public BASE_SVR_AMOUNT = 10000 * 10**18;

    IPoolController controller;

    constructor() {
        controllerAddress = msg.sender;
    }

    // called once by the controller at time of deployment
    function initialize(address _token) external override {
        require(
            msg.sender == controllerAddress,
            "Can not be initialized again"
        ); // sufficient check, poolController will initialize once after deployment
        controller = IPoolController(msg.sender);
        token = _token;
        tokenDecimals = IERC20(token).decimals();
        treasury = controller.reignDAO();
        svrToken = controller.svrToken();
        reignToken = controller.reignToken();
        liquidityBuffer = controller.liquidityBuffer();
    }

    //receive liquidity: mint LP tokens and mint SVR tokens
    function mint(address to)
        external
        override
        nonReentrant
        returns (uint256 liquidity)
    {
        uint256 _reserve = getReserves(); // gas savings
        uint256 _balance = getTokenBalance();
        uint256 amount = _balance.sub(_reserve);

        require(amount > 0, "Can only issue positive amounts");

        uint256 depositFee = getDepositFeeReign(amount);

        if (depositFee > 0) {
            IERC20 _reignToken = IERC20(reignToken);
            require(
                _reignToken.allowance(msg.sender, address(this)) >= depositFee,
                "Insufficient allowance"
            );
            _reignToken.safeTransferFrom(msg.sender, treasury, depositFee);
        }

        uint256 _totalSupply = totalSupply; // gas savings
        if (_totalSupply == 0) {
            liquidity = amount.sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = amount;
        }
        require(liquidity > 0, "Insufficient Liquidity Minted");

        //Mint LP Tokens
        _mint(to, liquidity);

        //store new balance in reserve
        _updateReserves();

        //mint SVR tokens based on new balance
        _mintSvr(to, amount);

        //accrue interest based on new balance
        _accrueInterest();
    }

    //burns LP tokens,burns SVR tokens and returns liquidity to user
    function burn(uint256 amount)
        external
        override
        nonReentrant
        returns (bool)
    {
        require(amount > 0, "Can only burn positive amounts");

        address _to = msg.sender;

        uint256 _withdrawFee = getWithdrawFeeReign(amount);

        if (_withdrawFee > 0) {
            IERC20 _reignToken = IERC20(reignToken);

            require(
                _reignToken.allowance(msg.sender, address(this)) >=
                    _withdrawFee,
                "Insufficient allowance"
            );
            _reignToken.safeTransferFrom(
                msg.sender,
                liquidityBuffer,
                _withdrawFee
            );
        }

        //burn LP tokens
        _burn(msg.sender, amount);

        //burn SVR tokens (before sending out tokens which reduces TVL)
        _burnSvr(_to, amount);

        //return liquidity
        _safeTransfer(_to, amount);

        //store new balance in reserve
        _updateReserves();

        //accrue interest based on new balance
        _accrueInterest();
    }

    // allow anyone to remove tokens if accidentaly sent to pool addres
    function skim(address to) external override nonReentrant {
        address _token = token; // gas savings
        _safeTransfer(to, IERC20(_token).balanceOf(address(this)).sub(reserve));
    }

    /**
        INTERNAL
     */

    // ERC20 transfer that can revert
    function _safeTransfer(address to, uint256 value) internal {
        address _token = token; // gas savings
        IERC20(_token).safeTransfer(to, value);
    }

    // update reserves to match token
    function _updateReserves() internal {
        reserve = getTokenBalance();
        emit Sync(reserve);
    }

    // Mints SVR tokens using the minting/burn formula, if there are no tokens mints the BASE_AMOUNT
    function _mintSvr(address to, uint256 amount) internal {
        uint256 _svrSupply = IMintBurnErc20(svrToken).totalSupply();
        uint256 _amountSvr;
        if (_svrSupply == 0) {
            _amountSvr = BASE_SVR_AMOUNT;
        } else {
            uint256 _price = controller.getTokenPrice(address(this));
            uint256 _valuePaid = amount.mul(_price).div(10**tokenDecimals);
            uint256 _TVL = controller.getPoolsTVL().sub(_valuePaid);
            _amountSvr = _valuePaid.mul(_svrSupply).div(_TVL);
        }

        IMintBurnErc20(svrToken).mint(to, _amountSvr);

        emit Mint(msg.sender, amount, _amountSvr);
    }

    // Burnd SVR tokens using the minting/burn formula
    function _burnSvr(address from, uint256 amount) internal {
        uint256 _svrSupply = IMintBurnErc20(svrToken).totalSupply();
        uint256 _TVL = controller.getPoolsTVL();
        uint256 _price = controller.getTokenPrice(address(this));
        uint256 _amountSvr =
            amount.mul(_price).mul(_svrSupply).div(_TVL).div(10**tokenDecimals);

        IMintBurnErc20(svrToken).burnFrom(from, _amountSvr);

        emit Burn(msg.sender, amount, _amountSvr);
    }

    // Calls accrue interest in the pools interest startegy contract
    function _accrueInterest() internal {
        uint256 _target = controller.getTargetSize(address(this));
        uint256 _reserves = getReserves();
        address interestStrategy =
            controller.getInterestStrategy(address(this));
        InterestStrategyInterface(interestStrategy).accrueInterest(
            _reserves,
            _target
        );
    }

    /*
     * VIEWS
     */

    function getReserves() public view override returns (uint256 _reserve) {
        _reserve = reserve;
    }

    function getTokenBalance() public view override returns (uint256 _balance) {
        _balance = IERC20(token).balanceOf(address(this));
    }

    // get the deposit fee to be paid to deposit a given amount of liquidity
    function getDepositFeeReign(uint256 amount) public view returns (uint256) {
        uint256 _target = controller.getTargetSize(address(this));
        uint256 _reserves = getReserves();

        if (_target == 0 || _reserves == 0) {
            return 0; // the initial amount into the pool will have no fee
        }

        address interestStrategy =
            controller.getInterestStrategy(address(this));

        (uint256 _, uint256 interestRate) =
            InterestStrategyInterface(interestStrategy).getFormulaOutput(
                _reserves.add(amount),
                _target
            );

        return
            (
                interestRate
                    .mul(depositFeeMultiplier)
                    .mul(amount)
                    .mul(controller.getTokenPrice(address(this)))
                    .div(controller.getReignPrice())
            )
                .div(10**tokenDecimals); //adjust for  token decimals
    }

    // get the withdraw fee to be paid to withdraw a given amount of liquidity
    function getWithdrawFeeReign(uint256 amount)
        public
        view
        returns (uint256 userFee)
    {
        InterestStrategyInterface interestStrategy =
            InterestStrategyInterface(
                controller.getInterestStrategy(address(this))
            );

        uint256 totalFeeAccrued =
            interestStrategy.withdrawFeeAccrued().mul(
                LibRewardsDistribution.rewardsPerBlockPerPool(
                    controller.getTargetAllocation(address(this)),
                    interestStrategy.epoch1Start() //we can use this as it is inherited by epochClock
                )
            );

        userFee = totalFeeAccrued.mul(amount).div(getReserves()).div(10**18);
    }
}
