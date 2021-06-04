// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

interface ISmartPool {
    function updateWeightsGradually(
        uint256[] memory,
        uint256,
        uint256
    ) external returns (address);

    function joinswapExternAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external returns (uint256);

    function exitswapPoolAmountIn(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function balanceOf(address owner) external view returns (uint256);
}
