// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../mocks/ERC20Mock.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract SmartPoolMock is ERC20Mock {
    uint256 public calledWeightsUpdate = 0;
    uint256 calledJoinswapExternAmountIn = 0;
    uint256 calledExitswapPoolAmountIn = 0;
    uint256 calledJoin = 0;
    uint256 calledExit = 0;

    BPool bpool;
    address smartPoolManager;

    constructor(address addr0, address addr1) {
        bpool = new BPool(addr0, addr1);
        smartPoolManager = address(new SmartPoolManager());
    }

    function updateWeightsGradually(
        uint256[] memory,
        uint256,
        uint256
    ) external returns (address) {
        calledWeightsUpdate += 1;
    }

    function joinswapExternAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external returns (uint256) {
        calledJoinswapExternAmountIn += 1;
        IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmountIn);
        _mint(msg.sender, minPoolAmountOut);
    }

    function exitswapPoolAmountIn(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        calledExitswapPoolAmountIn += 1;
        IERC20(tokenOut).transfer(msg.sender, minAmountOut);
        _burn(msg.sender, poolAmountIn);
    }

    function joinPool(uint256 poolAmountOut, uint256[] memory minAmountsIn)
        external
        returns (uint256)
    {
        calledJoin += 1;
        address[] memory tokens = bpool.getCurrentTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).transferFrom(
                msg.sender,
                address(this),
                minAmountsIn[i]
            );
        }
        _mint(msg.sender, poolAmountOut);
    }

    function exitPool(uint256 poolAmountIn, uint256[] memory minAmountsOut)
        external
        returns (uint256)
    {
        calledExit += 1;
        address[] memory tokens = bpool.getCurrentTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).transfer(msg.sender, minAmountsOut[i]);
        }
        _burn(msg.sender, poolAmountIn);
    }

    function bPool() public view returns (BPool) {
        return bpool;
    }

    function getSmartPoolManagerVersion() public view returns (address) {
        return smartPoolManager;
    }

    function getDenormalizedWeight(address token)
        external
        view
        returns (uint256)
    {
        return 10 * 10**18;
    }
}

contract BPool {
    address[] addr = new address[](2);

    constructor(address addr0, address addr1) {
        addr[0] = addr0;
        addr[1] = addr1;
    }

    function getCurrentTokens() public view returns (address[] memory) {
        return addr;
    }
}

contract SmartPoolManager {
    function joinPool(
        address c,
        address b,
        uint256 poolAmountOut,
        uint256[] memory maxAmountsIn
    ) public view returns (uint256[] memory) {
        return maxAmountsIn;
    }
}
