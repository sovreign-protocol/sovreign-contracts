// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../ChainlinkOracleAdapter.sol";
import "./Oracle_REIGN_ETH.sol";
import "../../interfaces/IOracleUpdateable.sol";
import "../../interfaces/IOracle.sol";

// We get the REIGN/ETH price from the uniswap moving widow oracle and the ETH/USD price from the Chainlink Oracle
// We derive REIGN/USD by multiplying the first value by the latter
contract Oracle_REIGN_USD is IOracleUpdateable {
    using SafeMath for uint256;

    address public override ownerAddress;

    IOracleUpdateable uniswapPairOracle;
    IOracle chanlinkEthOracle;

    constructor(
        address factory,
        address tokenA,
        address tokenB,
        address _ownerAddress,
        address oracleAddress
    ) {
        uniswapPairOracle = new Oracle_REIGN_ETH(
            factory,
            tokenA,
            tokenB,
            _ownerAddress
        );
        chanlinkEthOracle = IOracle(oracleAddress);

        ownerAddress = _ownerAddress;
    }

    // Check if update() can be called instead of wasting gas calling it
    function canUpdate() public view override returns (bool) {
        return uniswapPairOracle.canUpdate();
    }

    function update() external override {
        return uniswapPairOracle.update();
    }

    // Note this will always return 0 before update has been called successfully for the first time.
    function consult(address token, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        uint256 reignEthPrice = uniswapPairOracle.consult(token, amountIn);
        uint256 ethPrice = chanlinkEthOracle.consult(token, amountIn);

        return reignEthPrice.mul(ethPrice);
    }
}
