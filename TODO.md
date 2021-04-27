## List of ToDos

- [x] Rename SoV to SVR (token)
- [x] Rename all name occurrences to SoVReign
- [ ] Rename `bondStaked` to `svrStaked`
- [ ] Rename names (uniswap) pools
- [x] Deploy script (all contracts!)
- [x] Implement setController in the BasketBalancer and adapt tests
- [ ] Treasury of `PoolController`
      -- withdraw method impl.
      -- permission? Only the DAO?
- [ ] poolcontroller rename tokens
- [ ] rename Reign.sol to ReignDiamon.sol ?
- [ ] rename Governance.sol to ReignDAO.sol ?
- [ ] change the hardhat network config to have a "ganache" network (to deploy to the same remix network)
      -- check if the hardhat run reuse the same connection as the hardhat node (if previously running)
- [ ] change/adapt the `allPools[0]` in `getReignPrice()` (PoolController)
- [ ] check whether the rewards' distribution mechanism is tested. I mean, test the "amount of tokens distributed over time"
- [ ] update to solidity 0.8.x
- [ ] structure a bit the GitHub repos (README, description, issue templates, etc)


## Questions

- Something we could ask BarnBridge guys: if they ever got any example, use case, 
that it would require a `PROPOSAL_MAX_ACTIONS` higher than 10. Meaning: a proposal that it’s so complex, 
actions would go beyond `10`.