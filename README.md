# SoV-Reign Contracts

This repo has all smart contracts used by SoV-Reign.

The `./contracts` folder has the following structure:

- governance
- erc20
- pool
- periphery
  - oracle
  - entrypoint contracts
- staking
- interfaces
- libraries
- facets

## Contract's Architecture

TBD

## Development

### Dependencies

* node v12.10
* TBD

### Build & Test Instructions

```shell script
yarn install
yarn test
```

### Deploy 

TBD

## References or Useful Links

- Diamond Standard for upgradeability
  * Started from the reference implementation [here](https://github.com/mudgen/diamond-1) which was refactored
  * The features of this repo are on a single facet in [BarnFacet.sol](./contracts/facets/BarnFacet.sol)