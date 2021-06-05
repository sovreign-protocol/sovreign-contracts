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

    constructor(address _smartPool, address _wrappingContract) {
        smartPool = ISmartPool(_smartPool);
        wrappingContract = IWrapSVR(_wrappingContract);
    }

    function deposit(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut,
        uint256 liquidationFee
    ) public {
        // pull underlying token here
        IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmountIn);
        IERC20(tokenIn).approve(address(smartPool), tokenAmountIn);

        // swap underlying token for LP
        smartPool.joinswapExternAmountIn(
            tokenIn,
            tokenAmountIn,
            minPoolAmountOut
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

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);

        //transfer underlying to sender
        uint256 balance = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenOut).transfer(msg.sender, balance);
    }

    function liquidate(
        address liquidatedUser,
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP to here
        // also pay the liquidation fee in tokenOut ot liquidatedUser
        wrappingContract.liquidate(msg.sender, liquidatedUser, poolAmountIn);

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);
        uint256 amountRecieved = IERC20(tokenOut).balanceOf(address(this));

        // liquidation fee is paid in tokenOut tokens, it is set by lpOwner at deposit
        uint256 liquidationFeeAmount =
            amountRecieved
                .mul(wrappingContract.liquidationFee(liquidatedUser))
                .div(1000000);

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

        //transfer underlying to sender
        IERC20(tokenOut).transfer(msg.sender, amountRecieved);
    }
}
