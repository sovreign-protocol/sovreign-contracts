// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract BasketBalancerMock {
    using SafeMath for uint128;
    using SafeMath for uint256;

    uint256 public full_allocation;

    address public reignDiamond;
    address[] allTokens;
    mapping(address => uint256) tokenAllocation;

    constructor(
        address[] memory newtokens,
        uint256[] memory newAllocation,
        address _reignDiamond
    ) {
        for (uint256 i = 0; i < newtokens.length; i++) {
            uint256 tokenPercentage = newAllocation[i];
            tokenAllocation[newtokens[i]] = tokenPercentage;
            full_allocation = full_allocation.add(tokenPercentage);
        }
        allTokens = newtokens;
        reignDiamond = _reignDiamond;
    }

    function updateAllocationVote(
        address[] calldata tokens,
        uint256[] calldata allocations
    ) public {}

    function updateBasketBalance() external {}

    function computeAllocation() public pure returns (uint256[] memory) {}

    function hasVotedInEpoch(address user, uint128 epoch)
        external
        pure
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

    function getTargetAllocation(address token) public view returns (uint256) {
        return tokenAllocation[token];
    }

    function getTokens() public view returns (address[] memory) {
        return allTokens;
    }
}
