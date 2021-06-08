// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IWrapSVR.sol";
import "../interfaces/ISmartPool.sol";

contract PoolRouter {
    using SafeMath for uint256;

    ISmartPool smartPool;
    IWrapSVR wrappingContract;
    address public reignDao;
    address public treasoury;

    uint256 public protocolFee = 99950; // 100% - 0.050%

    uint256 public constant FEE_DECIMALS = 1000000;

    constructor(
        address _smartPool,
        address _wrappingContract,
        address _treasoury,
        uint256 _protocolFee
    ) {
        smartPool = ISmartPool(_smartPool);
        wrappingContract = IWrapSVR(_wrappingContract);
        treasoury = _treasoury;
        protocolFee = _protocolFee;
    }

    /**
        This methods performs the following actions:
            1. pull token for user
            2. joinswap into balancer pool, recieving lp
            3. stake lp tokens into Wrapping Contrat which mints SVR to User
    */
    function deposit(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut,
        uint256 liquidationFee
    ) public {
        // pull underlying token here
        IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmountIn);

        //take fee before swap
        uint256 amountMinusFee = tokenAmountIn.mul(protocolFee).div(100000);
        uint256 poolAmountMinusFee =
            minPoolAmountOut.mul(protocolFee).div(100000);

        IERC20(tokenIn).approve(address(smartPool), amountMinusFee);

        // swap underlying token for LP
        smartPool.joinswapExternAmountIn(
            tokenIn,
            amountMinusFee,
            poolAmountMinusFee
        );

        // deposit LP for sender and mint SVR to sender
        uint256 balance = smartPool.balanceOf(address(this));
        smartPool.approve(address(wrappingContract), balance);
        wrappingContract.deposit(msg.sender, balance, liquidationFee);
    }

    /**
        This methods performs the following actions:
            1. pull tokens for user
            2. join into balancer pool, recieving lp
            3. stake lp tokens into Wrapping Contrat which mints SVR to User
    */
    function depositAll(
        uint256[] memory maxTokensAmountIn,
        uint256 poolAmountOut,
        uint256 liquidationFee
    ) public {
        address[] memory tokens = getPoolTokens();
        uint256[] memory amountsIn =
            getAmountsTokensIn(poolAmountOut, maxTokensAmountIn);

        uint256[] memory amountsInMinusFee = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenIn = tokens[i];
            uint256 tokenAmountIn = amountsIn[i];
            // pull underlying token here
            IERC20(tokenIn).transferFrom(
                msg.sender,
                address(this),
                tokenAmountIn
            );

            //take fee before swap
            uint256 amountMinusFee = tokenAmountIn.mul(protocolFee).div(100000);

            amountsInMinusFee[i] = amountMinusFee;

            IERC20(tokenIn).approve(address(smartPool), amountMinusFee);
        }

        uint256 poolAmountMinusFee = poolAmountOut.mul(protocolFee).div(100000);

        // swap underlying token for LP
        smartPool.joinPool(poolAmountMinusFee, amountsInMinusFee);

        // deposit LP for sender and mint SVR to sender
        uint256 balance = smartPool.balanceOf(address(this));
        smartPool.approve(address(wrappingContract), balance);
        wrappingContract.deposit(msg.sender, balance, liquidationFee);
    }

    /**
        This methods performs the following actions:
            1. burn SVR from user and unstake lp
            2. exitswap lp into one of the underlyings
            3. send the underlying to the User
    */
    function withdraw(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP from sender to here
        wrappingContract.withdraw(msg.sender, msg.sender, poolAmountIn);

        //get balance before exitswap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);

        //get balance after exitswap
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));

        //take fee before transfer out
        uint256 amountMinusFee =
            (balanceAfter.sub(balanceBefore)).mul(protocolFee).div(100000);

        IERC20(tokenOut).transfer(msg.sender, amountMinusFee);
    }

    /**
        This methods performs the following actions:
            1. burn SVR from user and unstake lp
            2. exitswap lp into all of the underlyings
            3. send the underlyings to the User
    */
    function withdrawAll(uint256 poolAmountIn, uint256[] memory minAmountsOut)
        public
    {
        address[] memory tokens = getPoolTokens();

        uint256[] memory balancesBefore = new uint256[](tokens.length);

        //burns SVR from sender and recieve LP from sender to here
        wrappingContract.withdraw(msg.sender, msg.sender, poolAmountIn);

        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenOut = tokens[i];

            //get balance before exitswap
            balancesBefore[i] = IERC20(tokenOut).balanceOf(address(this));
        }

        //swaps LP for underlying
        smartPool.exitPool(poolAmountIn, minAmountsOut);

        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenOut = tokens[i];

            //get balance after exitswap
            uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));

            //take fee before transfer out
            uint256 amountMinusFee =
                (balanceAfter.sub(balancesBefore[i])).mul(protocolFee).div(
                    100000
                );

            IERC20(tokenOut).transfer(msg.sender, amountMinusFee);
        }
    }

    /**
        This methods performs the following actions:
            1. burn SVR from caller and unstake lp of liquidatedUser
            2. exitswap lp into one of the underlyings
            3. send the underlying to the caller
            4. transfer fee from caller to liquidatedUser
    */
    function liquidate(
        address liquidatedUser,
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) public {
        //burns SVR from sender and recieve LP to here
        wrappingContract.liquidate(msg.sender, liquidatedUser, poolAmountIn);

        //get balance before exitswap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        //swaps LP for underlying
        smartPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut);

        //get balance after exitswap
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));

        //take protocol fee before transfer
        uint256 amountMinusFee =
            (balanceAfter.sub(balanceBefore)).mul(protocolFee).div(100000);

        IERC20(tokenOut).transfer(msg.sender, amountMinusFee);

        // liquidation fee is paid in tokenOut tokens, it is set by lpOwner at deposit
        uint256 liquidationFeeAmount =
            (balanceAfter.sub(balanceBefore))
                .mul(wrappingContract.liquidationFee(liquidatedUser))
                .div(FEE_DECIMALS);

        require(
            IERC20(tokenOut).allowance(msg.sender, address(this)) >=
                liquidationFeeAmount,
            "Insuffiecient allowance for liquidation Fee"
        );

        // transfer liquidation fee from liquidator to original owner
        IERC20(tokenOut).transferFrom(
            msg.sender,
            liquidatedUser,
            liquidationFeeAmount
        );
    }

    // transfer the entire fees collected in this contract to DAO treasoury
    function collectFeesToDAO(address token) public {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(treasoury, balance);
    }

    /**
        VIEWS
     */

    // gets all tokens currently in the pool
    function getPoolTokens() public view returns (address[] memory) {
        BPool bPool = smartPool.bPool();
        return bPool.getCurrentTokens();
    }

    // gets all tokens currently in the pool
    function getTokenWeights() public view returns (uint256[] memory) {
        address[] memory tokens = getPoolTokens();
        uint256[] memory weights = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            weights[i] = smartPool.getDenormalizedWeight(tokens[i]);
        }
        return weights;
    }

    // NOTE: The follwing lines are not covered by unit test, they just forwards the data from SmartPoolManager

    // gets current LP exchange rate for all
    function getAmountsTokensIn(
        uint256 poolAmountOut,
        uint256[] memory maxAmountsIn
    ) public view returns (uint256[] memory) {
        address manager = smartPool.getSmartPoolManagerVersion();
        return
            SmartPoolManager(manager).joinPool(
                ConfigurableRightsPool(address(this)),
                smartPool.bPool(),
                poolAmountOut,
                maxAmountsIn
            );
    }

    // gets current LP exchange rate for single Asset
    function getAmountsTokensInSingle(
        address tokenIn,
        uint256 amountTokenIn,
        uint256 minPoolAmountOut
    ) public view returns (uint256) {
        address manager = smartPool.getSmartPoolManagerVersion();
        return
            SmartPoolManager(manager).joinswapExternAmountIn(
                ConfigurableRightsPool(address(this)),
                smartPool.bPool(),
                tokenIn,
                amountTokenIn,
                minPoolAmountOut
            );
    }

    // gets current LP exchange rate for all
    function getAmountPoolOut(
        uint256 poolAmountIn,
        uint256[] memory minAmountsOut
    )
        public
        view
        returns (
            uint256,
            uint256,
            uint256[] memory
        )
    {
        address manager = smartPool.getSmartPoolManagerVersion();
        return
            SmartPoolManager(manager).exitPool(
                ConfigurableRightsPool(address(this)),
                smartPool.bPool(),
                poolAmountIn,
                minAmountsOut
            );
    }
}
