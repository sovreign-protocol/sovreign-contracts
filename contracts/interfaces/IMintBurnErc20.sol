// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintBurnErc20 is IERC20 {
    event Burn(address indexed from, uint256 value);
    event Mint(address indexed to, uint256 value);

    function burn(address from, uint256 amount) external;

    function mint(address to, uint256 amount) external;
}
