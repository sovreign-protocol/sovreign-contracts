// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "../interfaces/IWrapSVR.sol";
import "../interfaces/IMintBurnErc20.sol";

contract RouterMock {
    IMintBurnErc20 underlyingToken;
    IMintBurnErc20 smartPool;
    address reignDao;
    address wrappingContract;

    constructor(address _smartPool, address _wrappingContract) {
        smartPool = IMintBurnErc20(_smartPool);
        wrappingContract = _wrappingContract;
    }

    function deposit(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut,
        uint256 liquidationFee
    ) public {
        // pull underlying token here
        IMintBurnErc20(tokenIn).transferFrom(
            msg.sender,
            address(this),
            tokenAmountIn
        );

        // swap underlying token for LP
        IMintBurnErc20(tokenIn).burn(address(this), tokenAmountIn);
        smartPool.mint(address(this), minPoolAmountOut);

        // deposit LP for sender and mint SVR to sender
        uint256 balance = smartPool.balanceOf(address(this));
        smartPool.approve(wrappingContract, balance);
        IWrapSVR(wrappingContract).deposit(msg.sender, balance, liquidationFee);
    }

    function withdraw(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP from sender to here
        IWrapSVR(wrappingContract).withdraw(
            msg.sender,
            msg.sender,
            poolAmountIn
        );

        IMintBurnErc20(tokenOut).mint(address(this), minAmountOut);
        smartPool.burn(address(this), poolAmountIn);

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
        IWrapSVR(wrappingContract).liquidate(
            msg.sender,
            tokenOut,
            liquidatedUser,
            poolAmountIn
        );

        IMintBurnErc20(tokenOut).mint(address(this), minAmountOut);
        smartPool.burn(address(this), poolAmountIn);

        //transfer underlying to sender
        uint256 balance = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenOut).transfer(msg.sender, balance);
    }
}
