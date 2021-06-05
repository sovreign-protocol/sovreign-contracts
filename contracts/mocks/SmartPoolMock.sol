// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/ISmartPool.sol";
import "./ERC20Mock.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract SmartPoolMock is ERC20Mock {
    uint256 public calledWeightsUpdate = 0;
    uint256 calledJoinswapExternAmountIn = 0;
    uint256 calledExitswapPoolAmountIn = 0;

    constructor() {}

    function updateWeightsGradually(
        uint256[] memory,
        uint256,
        uint256
    ) external returns (address) {
        calledWeightsUpdate += 1;
    }

    function joinswapExternAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external returns (uint256) {
        calledJoinswapExternAmountIn += 1;
        IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmountIn);
        _mint(msg.sender, minPoolAmountOut);
    }

    function exitswapPoolAmountIn(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        calledExitswapPoolAmountIn += 1;
        IERC20(tokenOut).transfer(msg.sender, minAmountOut);
        _burn(msg.sender, poolAmountIn);
    }
}
