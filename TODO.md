## List of ToDos

All TODOs are now migrated to [https://github.com/dialecticch/sovreign-contracts/issues](https://github.com/dialecticch/sovreign-contracts/issues).

## Questions / Observations

- Something we could ask BarnBridge guys: if they ever got any example, use case, 
that it would require a `PROPOSAL_MAX_ACTIONS` higher than 10. Meaning: a proposal that it’s so complex, 
actions would go beyond `10`.
- Good practice: when a proposal for `createPool` is created, REIGN voters/holders should always evaluate
whether the specified Oracle points to a pool with "enough" liquidity. Otherwise, it's a good practice
to reject the proposal.
- Good practice: when a proposal for `createPool` is created, REIGN holders/voters should always evaluate
whether the Oracle and InterestStrategy contracts have `reignDAO` as owners.