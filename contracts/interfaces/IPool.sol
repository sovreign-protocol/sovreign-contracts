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

    function tokenDecimals() external view returns (uint256);

    function treasury() external view returns (address);

    function liquidityBuffer() external view returns (address);

    function svrToken() external view returns (address);

    function reignToken() external view returns (address);

    function getReserves() external view returns (uint256 reserve);

    function getTokenBalance() external view returns (uint256 reserve);

    function amountSvrForAmountLp(uint256) external view returns (uint256);

    function feeIn() external view returns (uint256);

    function feeOut() external view returns (uint256);

    function premiumFactor() external view returns (uint256);

    function mint(address to, uint256 amount)
        external
        returns (uint256 liquidity);

    function burn(uint256 amount) external returns (bool);

    function skim(address to) external;

    function initialize(address) external;
}
