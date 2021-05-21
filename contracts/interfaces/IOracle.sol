// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

interface IOracle {
    function consult(address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    function ownerAddress() external view returns (address);
}
