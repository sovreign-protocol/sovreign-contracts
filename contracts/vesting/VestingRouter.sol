// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VestingRouter {
    address[] public _vestingAddresses;
    uint256[] public _vestingAmounts;
    uint256 public lastAllocatedAddress;
    IERC20 private _reign;

    constructor(
        address[] memory vestingAddresses,
        uint256[] memory vestingAmount,
        address reignToken
    ) {
        _vestingAddresses = vestingAddresses;
        _vestingAmounts = vestingAmount;
        _reign = IERC20(reignToken);
    }

    function allocateVestingFunds() public {
        for (
            uint256 i = lastAllocatedAddress;
            i < _vestingAddresses.length;
            i++
        ) {
            if (
                _reign.balanceOf(address(this)) < _vestingAmounts[i] ||
                gasleft() < 40000
            ) {
                break;
            }
            lastAllocatedAddress++;
            _reign.transfer(_vestingAddresses[i], _vestingAmounts[i]);
        }
    }
}
