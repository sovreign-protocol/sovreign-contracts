// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../UniswapPairOracle.sol";

// Fixed window oracle that recomputes the average price for the entire period once every period
// Note that the price average is only guaranteed to be over at least 1 period, but may be over a longer period

contract Oracle_REIGN_ETH is UniswapPairOracle {
    constructor(
        address factory,
        address tokenA,
        address tokenB,
        address owner
    ) UniswapPairOracle(factory, tokenA, tokenB, owner) {}
}
