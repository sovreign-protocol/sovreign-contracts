// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/UniswapV2Library.sol";
import "../libraries/UniswapV2OracleLibrary.sol";

import "../interfaces/IOracle.sol";

/**
    This contract has been taken without any change from:
    https://github.com/FraxFinance/frax-solidity/blob/master/contracts/Oracle/UniswapPairOracle.sol

    **DISCLAIMER:**
    There is no test coverage for the Oracle in this repo, as there is coverage in the 
    source repository and the contracts have been battle tested in the wild for a long 
    enough time to be deemed as sound and safe
 */

// Fixed window oracle that recomputes the average price for the entire period once every period
// Note that the price average is only guaranteed to be over at least 1 period, but may be over a longer period
contract UniswapPairOracle is IOracle {
    using FixedPoint for *;

    address public override ownerAddress;
    address timelock_address;

    uint256 public PERIOD = 3600; // 1 hour TWAP (time-weighted average price)
    uint256 public CONSULT_LENIENCY = 120; // Used for being able to consult past the period end
    bool public ALLOW_STALE_CONSULTS = true; // If false, consult() will fail if the TWAP is stale

    IUniswapV2Pair public immutable pair;
    address public immutable token0;
    address public immutable token1;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;
    FixedPoint.uq112x112 public price0Average;
    FixedPoint.uq112x112 public price1Average;

    modifier onlyByOwnerOrGovernance() {
        require(
            msg.sender == ownerAddress || msg.sender == timelock_address,
            "You are not an owner or the governance timelock"
        );
        _;
    }

    constructor(
        address factory,
        address tokenA,
        address tokenB,
        address _ownerAddress,
        address _timelock_address
    ) {
        IUniswapV2Pair _pair =
            IUniswapV2Pair(UniswapV2Library.pairFor(factory, tokenA, tokenB));
        pair = _pair;
        token0 = _pair.token0();
        token1 = _pair.token1();
        price0CumulativeLast = _pair.price0CumulativeLast(); // Fetch the current accumulated price value (1 / 0)
        price1CumulativeLast = _pair.price1CumulativeLast(); // Fetch the current accumulated price value (0 / 1)
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = _pair.getReserves();
        require(
            reserve0 != 0 && reserve1 != 0,
            "UniswapPairOracle: NO_RESERVES"
        ); // Ensure that there's liquidity in the pair

        ownerAddress = _ownerAddress;
        timelock_address = _timelock_address;
    }

    function setOwner(address _ownerAddress) external onlyByOwnerOrGovernance {
        ownerAddress = _ownerAddress;
    }

    function setTimelock(address _timelock_address)
        external
        onlyByOwnerOrGovernance
    {
        timelock_address = _timelock_address;
    }

    function setPeriod(uint256 _period) external onlyByOwnerOrGovernance {
        PERIOD = _period;
    }

    function setConsultLeniency(uint256 _consult_leniency)
        external
        onlyByOwnerOrGovernance
    {
        CONSULT_LENIENCY = _consult_leniency;
    }

    function setAllowStaleConsults(bool _allow_stale_consults)
        external
        onlyByOwnerOrGovernance
    {
        ALLOW_STALE_CONSULTS = _allow_stale_consults;
    }

    // Check if update() can be called instead of wasting gas calling it
    function canUpdate() public view returns (bool) {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // Overflow is desired
        return (timeElapsed >= PERIOD);
    }

    function update() external {
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // Overflow is desired

        // Ensure that at least one full period has passed since the last update
        require(timeElapsed >= PERIOD, "UniswapPairOracle: PERIOD_NOT_ELAPSED");

        // Overflow is desired, casting never truncates
        // Cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        price0Average = FixedPoint.uq112x112(
            uint224((price0Cumulative - price0CumulativeLast) / timeElapsed)
        );
        price1Average = FixedPoint.uq112x112(
            uint224((price1Cumulative - price1CumulativeLast) / timeElapsed)
        );

        price0CumulativeLast = price0Cumulative;
        price1CumulativeLast = price1Cumulative;
        blockTimestampLast = blockTimestamp;
    }

    // Note this will always return 0 before update has been called successfully for the first time.
    function consult(address token, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // Overflow is desired

        // Ensure that the price is not stale
        require(
            (timeElapsed < (PERIOD + CONSULT_LENIENCY)) || ALLOW_STALE_CONSULTS,
            "UniswapPairOracle: PRICE_IS_STALE_NEED_TO_CALL_UPDATE"
        );

        if (token == token0) {
            amountOut = price0Average.mul(amountIn).decode144();
        } else {
            require(token == token1, "UniswapPairOracle: INVALID_TOKEN");
            amountOut = price1Average.mul(amountIn).decode144();
        }
    }
}
