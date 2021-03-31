// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "./IERC20.sol";

interface IMintBurnErc20 is IERC20 {
    event Burn(address indexed from, uint256 value);
    event Mint(address indexed to, uint256 value);

    function burnFrom(address from, uint256 amount) external returns (bool);

    function mint(address to, uint256 amount) external returns (bool);
}
