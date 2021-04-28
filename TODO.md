## List of ToDos

- [x] Rename SoV to SVR (token)
- [x] Rename all name occurrences to SoVReign
- [ ] Rename `bondStaked` to `svrStaked`
- [ ] Rename names (uniswap) pools
- [x] Deploy script (all contracts!)
- [x] Implement setController in the BasketBalancer and adapt tests
- [x] Treasury of `PoolController`
      -- withdraw method impl.
      -- permission? Only the DAO?
- [ ] poolcontroller rename tokens
- [ ] rename Reign.sol to ReignDiamond.sol ?
- [ ] rename Governance.sol to ReignDAO.sol ?
- [ ] change the hardhat network config to have a "ganache" network (to deploy to the same remix network)
      -- check if the hardhat run reuse the same connection as the hardhat node (if previously running)
- [ ] change/adapt the `allPools[0]` in `getReignPrice()` (PoolController)
      -- have a default oracle contract or REIGN token
- [ ] check whether the rewards' distribution mechanism is tested. I mean, test the "amount of tokens distributed over time"
- [ ] update to solidity 0.8.x
- [ ] add a 'onlyDAO' to the BasketBalancer for setMaxDelta()
- [ ] change the `createPool()` to ensure that the Oracle **AND** InterestStrategy contracts have
the `reignDAO` as owners. If not, revert.
- [ ] Workshop: define more realistic scenarios for end-to-end testing (including staking and shit)
- [ ] Create issues on GitHub [Guil]
- [ ] Structure a bit the GitHub repos (README, description, issue templates, etc) [Guil]

## Questions / Observations

- Something we could ask BarnBridge guys: if they ever got any example, use case, 
that it would require a `PROPOSAL_MAX_ACTIONS` higher than 10. Meaning: a proposal that it’s so complex, 
actions would go beyond `10`.
- Good practice: when a proposal for `createPool` is created, REIGN voters/holders should always evaluate
whether the specified Oracle points to a pool with "enough" liquidity. Otherwise, it's a good practice
to reject the proposal.
- Good practice: when a proposal for `createPool` is created, REIGN holders/voters should always evaluate
whether the Oracle and InterestStrategy contracts have `reignDAO` as owners.