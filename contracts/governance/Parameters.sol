// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.7.6;

abstract contract Parameters {
    // These values are set very low in the beginnign to allow the DAO to quickly interveen in case of
    // maliscious attacks or other problems.
    // Once the DAO has reched a more mature stage these will be voted to be 3-4 days each
    uint256 public warmUpDuration = 1 hours;
    uint256 public activeDuration = 1 hours;
    uint256 public queueDuration = 1 hours;
    uint256 public gracePeriodDuration = 1 hours;

    uint256 public gradualWeightUpdate = 2 days;

    uint256 public acceptanceThreshold = 60;
    uint256 public minQuorum = 40;

    uint256 constant ACTIVATION_THRESHOLD = 4_000_000 * 10**18;
    uint256 constant PROPOSAL_MAX_ACTIONS = 10;

    modifier onlyDAO() {
        require(msg.sender == address(this), "Only DAO can call");
        _;
    }

    function setWarmUpDuration(uint256 period) public onlyDAO {
        warmUpDuration = period;
    }

    function setGradualWeightUpdate(uint256 period) public onlyDAO {
        gradualWeightUpdate = period;
    }

    function setActiveDuration(uint256 period) public onlyDAO {
        require(period >= 1 days, "period must be > 0");
        activeDuration = period;
    }

    function setQueueDuration(uint256 period) public onlyDAO {
        queueDuration = period;
    }

    function setGracePeriodDuration(uint256 period) public onlyDAO {
        require(period >= 1 days, "period must be > 0");
        gracePeriodDuration = period;
    }

    function setAcceptanceThreshold(uint256 threshold) public onlyDAO {
        require(threshold <= 100, "Maximum is 100.");
        require(threshold > 50, "Minimum is 50.");

        acceptanceThreshold = threshold;
    }

    function setMinQuorum(uint256 quorum) public onlyDAO {
        require(quorum > 5, "quorum must be greater than 5");
        require(quorum <= 100, "Maximum is 100.");

        minQuorum = quorum;
    }
}
