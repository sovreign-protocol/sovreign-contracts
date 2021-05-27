// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../ChainlinkOracleAdapter.sol";

contract Oracle_ETH_USD is ChainlinkOracleAdapter {
    constructor(address _oracleAddress, address _ownerAddress)
        ChainlinkOracleAdapter(_oracleAddress, _ownerAddress)
    {}
}
