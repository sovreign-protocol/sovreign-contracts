// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IOracle.sol";

contract OracleMock is IOracle {
    function observationIndexOf(uint256 timestamp)
        external
        view
        override
        returns (uint8 index)
    {
        return 0;
    }

    function update(address tokenA, address tokenB) external override {}

    function consult(address tokenIn, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        return amountIn;
    }
}
