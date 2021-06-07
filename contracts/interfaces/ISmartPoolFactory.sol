// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "./ISmartPool.sol";

interface ISmartPoolFactory {
    function newCrp(
        address factoryAddress,
        PoolParams calldata poolParams,
        Rights calldata rights
    ) external returns (ConfigurableRightsPool);

    struct PoolParams {
        // Balancer Pool Token (representing shares of the pool)
        string poolTokenSymbol;
        string poolTokenName;
        // Tokens inside the Pool
        address[] constituentTokens;
        uint256[] tokenBalances;
        uint256[] tokenWeights;
        uint256 swapFee;
    }

    struct Rights {
        bool canPauseSwapping;
        bool canChangeSwapFee;
        bool canChangeWeights;
        bool canAddRemoveTokens;
        bool canWhitelistLPs;
        bool canChangeCap;
    }
}
