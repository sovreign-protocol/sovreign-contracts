// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IReign.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MulticallMock {
    using SafeMath for uint256;

    IReign reign;
    IERC20 reignToken;

    constructor(address _reign, address _reignToken) {
        reign = IReign(_reign);
        reignToken = IERC20(_reignToken);
    }

    function multiDelegate(
        uint256 amount,
        address user1,
        address user2
    ) public {
        reignToken.approve(address(reign), amount);

        reign.deposit(amount);
        reign.delegate(user1);
        reign.delegate(user2);
        reign.delegate(user1);
    }

    function multiDeposit(uint256 amount) public {
        reignToken.approve(address(reign), amount.mul(3));

        reign.deposit(amount);
        reign.deposit(amount);
        reign.deposit(amount);
    }
}
