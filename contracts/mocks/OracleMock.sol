// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IOracle.sol";

contract OracleMock is IOracle {
    address public override ownerAddress;

    constructor(address _owner_address) {
        ownerAddress = _owner_address;
    }

    function update() external {}

    function consult(address tokenIn, uint256 amountIn)
        external
        pure
        override
        returns (uint256 amountOut)
    {
        return 2 * 10**6;
    }
}
