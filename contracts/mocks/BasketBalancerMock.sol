// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "../interfaces/IBasketBalancer.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancerMock is IBasketBalancer {
    using SafeMath for uint128;
    using SafeMath for uint256;

    uint256 public override full_allocation;

    address public override reignAddress;
    address[] allTokens;
    mapping(address => uint256) tokenAllocation;

    constructor(
        address[] memory newtokens,
        uint256[] memory newAllocation,
        address _reignAddress
    ) {
        for (uint256 i = 0; i < newtokens.length; i++) {
            uint256 tokenPercentage = newAllocation[i];
            tokenAllocation[newtokens[i]] = tokenPercentage;
            full_allocation = full_allocation.add(tokenPercentage);
        }
        allTokens = newtokens;
        reignAddress = _reignAddress;
    }

    function updateAllocationVote(
        address[] calldata tokens,
        uint256[] calldata allocations
    ) public {}

    function updateBasketBalance() external override {}

    function computeAllocation() public pure returns (uint256[] memory) {}

    function hasVotedInEpoch(address user, uint128 epoch)
        external
        pure
        override
        returns (bool)
    {
        if (epoch.mod(2) == 0) {
            return true;
        } else {
            return false;
        }
    }

    function getAllocationVote()
        public
        pure
        returns (
            address[] memory,
            uint256[] memory,
            uint256
        )
    {}

    function getTargetAllocation(address token)
        public
        view
        override
        returns (uint256)
    {
        return tokenAllocation[token];
    }

    function addToken(address token, uint256 allocation)
        public
        override
        returns (uint256)
    {
        tokenAllocation[token] = allocation;
        full_allocation = full_allocation.add(allocation);
        return allTokens.length;
    }

    function getTokens() public view override returns (address[] memory) {
        return allTokens;
    }
}
