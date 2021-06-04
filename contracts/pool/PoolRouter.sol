// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IPool.sol";
import "../interfaces/IPoolController.sol";

import "../libraries/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "hardhat/console.sol";

contract PoolRouter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public controller;
    address reignDao;
    address reignToken;

    constructor(address _reignDao) {
        reignDao = _reignDao;
    }

    function setController(address _controller) public {
        require(msg.sender == reignDao, "Only the DAO can do this");
        controller = _controller;
        reignToken = IPoolController(_controller).reignToken();
    }

    /**
        Allows a user to deposit multiple tokens at the same time, paying the deposit fee only once and
        using the values that would be if the tx are made individually but at the same time,
        it is always reccomended to use this when depositing more then one asset
     */
    function multiDeposit(address[] memory pools, uint256[] memory amounts)
        public
    {
        // Get how much deposit fee is to pay, this is for the current state before the balance is changed
        uint256 totalDepositFee = getTotalDepositFeeReign(pools, amounts);

        // only if deposit fee is above 0.1 REIGN take it
        if (totalDepositFee > 10**17) {
            IERC20 _reignToken = IERC20(reignToken);

            require(
                _reignToken.allowance(msg.sender, address(this)) >=
                    totalDepositFee,
                "Insufficient allowance"
            );
            _reignToken.safeTransferFrom(msg.sender, reignDao, totalDepositFee);
        }

        //transfer underlying tokens from sender to pool and call mintRouter
        for (uint256 i = 0; i < pools.length; i++) {
            IPool pool = IPool(pools[i]);
            IERC20(pool.token()).safeTransferFrom(
                msg.sender,
                address(pool),
                amounts[i]
            );

            pool.mintRouter(msg.sender);
        }
    }

    function getTotalDepositFeeReign(
        address[] memory pools,
        uint256[] memory amounts
    ) public view returns (uint256) {
        // Get how much deposit fee is to pay, this is for the current state before the balance is changed
        uint256 totalDepositFee;
        for (uint256 i = 0; i < pools.length; i++) {
            IPool pool = IPool(pools[i]);

            totalDepositFee = totalDepositFee.add(
                pool.getDepositFeeReign(amounts[i])
            );
        }
        return totalDepositFee;
    }
}
