// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../UniswapPairOracle.sol";

// Fixed window oracle that recomputes the average price for the entire period once every period
// Note that the price average is only guaranteed to be over at least 1 period, but may be over a longer period

// factory: the pool factory (e.g., uniswap factory)
// tokenA and tokenB: addresses for the pair
// owner: the reignDAO
// timelock: ?
contract UniswapPairOracle_REIGN_WETH is UniswapPairOracle {
    constructor(
        address factory,
        address tokenA,
        address tokenB,
        address owner,
        address timelock
    )
        UniswapPairOracle(
            factory,
            tokenA,
            tokenB,
            owner,
            timelock
        )
    {}
}
