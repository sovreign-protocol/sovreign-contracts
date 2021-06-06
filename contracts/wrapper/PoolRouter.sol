// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISmartPool.sol";
import "../interfaces/IWrapSVR.sol";

contract PoolRouter {
    using SafeMath for uint256;

    ISmartPool smartPool;
    IWrapSVR wrappingContract;
    address reignDao;
    address treasoury;

    uint256 protocolFee = 99950; // 100% - 0.050% -> 100000 is 100%

    uint256 FEE_DECIMALS = 1000000;

    constructor(
        address _smartPool,
        address _wrappingContract,
        address _treasoury,
        uint256 _protocolFee
    ) {
        smartPool = ISmartPool(_smartPool);
        wrappingContract = IWrapSVR(_wrappingContract);
        treasoury = _treasoury;
        protocolFee = _protocolFee;
    }

    function deposit(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut,
        uint256 liquidationFee
    ) public {
        // pull underlying token here
        IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmountIn);

        //take fee before swap
        uint256 amountMinusFee = tokenAmountIn.mul(protocolFee).div(100000);
        uint256 poolAmountMinusFee =
            minPoolAmountOut.mul(protocolFee).div(100000);

        IERC20(tokenIn).approve(address(smartPool), amountMinusFee);

        // swap underlying token for LP
        smartPool.joinswapExternAmountIn(
            tokenIn,
            amountMinusFee,
            poolAmountMinusFee
        );

        // deposit LP for sender and mint SVR to sender
        uint256 balance = smartPool.balanceOf(address(this));
        smartPool.approve(address(wrappingContract), balance);
        wrappingContract.deposit(msg.sender, balance, liquidationFee);
    }

    function withdraw(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP from sender to here
        wrappingContract.withdraw(msg.sender, msg.sender, poolAmountIn);

        //get balance before exitswap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);

        //get balance after exitswap
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));

        //take fee before transfer out
        uint256 amountMinusFee =
            (balanceAfter.sub(balanceBefore)).mul(protocolFee).div(100000);

        IERC20(tokenOut).transfer(msg.sender, amountMinusFee);
    }

    function liquidate(
        address liquidatedUser,
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP to here
        wrappingContract.liquidate(msg.sender, liquidatedUser, poolAmountIn);

        //get balance before exitswap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);

        //get balance after exitswap
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));

        //take protocol fee before transfer
        uint256 amountMinusFee =
            (balanceAfter.sub(balanceBefore)).mul(protocolFee).div(100000);

        IERC20(tokenOut).transfer(msg.sender, amountMinusFee);

        // liquidation fee is paid in tokenOut tokens, it is set by lpOwner at deposit
        uint256 liquidationFeeAmount =
            (balanceAfter.sub(balanceBefore))
                .mul(wrappingContract.liquidationFee(liquidatedUser))
                .div(FEE_DECIMALS);

        require(
            IERC20(tokenOut).allowance(msg.sender, address(this)) >=
                liquidationFeeAmount,
            "Insuffiecient allowance for liquidation Fee"
        );

        // transfer liquidation fee from liquidator to original owner
        IERC20(tokenOut).transferFrom(
            msg.sender,
            liquidatedUser,
            liquidationFeeAmount
        );
    }

    // transfer the entire fees collected in this contract to DAO treasoury
    function collectFeesToDAO(address token) public {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(treasoury, balance);
    }
}
