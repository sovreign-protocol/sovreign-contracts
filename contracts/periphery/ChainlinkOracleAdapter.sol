// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "../interfaces/IOracle.sol";

interface ChainlinkOracle {
    function latestAnswer() external view returns (int256);
}

contract ChainlinkOracleAdapter is IOracle {
    address public override ownerAddress;
    address public oracleAddress;

    constructor(address _oracleAddress, address _ownerAddress) {
        oracleAddress = _oracleAddress;
        ownerAddress = _ownerAddress;
    }

    function consult(address tokenIn, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        return uint256(ChainlinkOracle(oracleAddress).latestAnswer()) / 100; //Orcale returns 8 decimals, we need 6
    }
}
