// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

interface IOracleUpdateable {
    function consult(address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    function canUpdate() external view returns (bool);

    function update() external;

    function ownerAddress() external view returns (address);
}
