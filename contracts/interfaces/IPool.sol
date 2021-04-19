// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

interface IPool {
    event Mint(address indexed sender, uint256 amountToken, uint256 amountSov);
    event Burn(address indexed sender, uint256 amountToken, uint256 amountSov);
    event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated);
    event Sync(uint256 reserve);

    function MINIMUM_LIQUIDITY() external pure returns (uint256);

    function controllerAddress() external view returns (address);

    function token() external view returns (address);

    function treasoury() external view returns (address);

    function getReserves() external view returns (uint256 reserve);

    function feeIn() external view returns (uint256);

    function feeOut() external view returns (uint256);

    function premiumFactor() external view returns (uint256);

    function svrToken() external view returns (address);

    function reignToken() external view returns (address);

    function mint(address to) external returns (uint256 liquidity);

    function burn(uint256 amount) external returns (bool);

    function skim(address to) external;

    function sync() external;

    function initialize(
        address,
        address,
        address,
        address
    ) external;
}
