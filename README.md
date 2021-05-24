![Build and Test](https://github.com/dialecticch/sovreign-contracts/actions/workflows/build.yml/badge.svg?branch=master)

# SoVReign Contracts

This repo has all smart contracts used by SoVReign.

The `./contracts` folder has the following structure:

- `./facets/`: contains the Diamond Facets utilized
- `./governance/`: contains contracts related to the ReignDAO, the Diamond Proxy and Governance Rewards
- `./interfaces/`: contains all interfaces used across the protocol
- `./libraries/`: contains all libraries
- `./mocks/`: contains mock contracts used for testing
- `./periphery/`: contains: oracles, the basket balancer and the default interest
- `./pool/`: contains all functionality related to pools
- `./staking/`: contains all yield-farming and staking contracts
- `./tokens/`: contains the SVR and REIGN Token contracts
- `./vesting/`: contains vesting contracts for the team and early investors

# solc

This project is using the solidity compiler version 0.7.6

# Dependencies

- node v14.14
- hardhat v2.
- openzeppelin-contracts v3.2.2-solc-0.7
- docker
- docker-compose

# Commands

## Install dependencies

```shell script
yarn install
```

## Compile

```shell script
yarn compile
```

## Test

```shell script
yarn test
```

## Test Single

```shell script
yarn test ./test/<TestName>.test.ts
```

## Coverage

```shell script
yarn coverage
```

# Deployment

- Just deploy and set-up all contracts:

```shell script
hardhat run scripts/run-deploy-all.ts
```

- Run the `scenario1`:

```shell script
hardhat run scripts/run-scenario1.ts
```

- Run the `scenario2`:

```shell script
hardhat run scripts/run-scenario2.ts
```

# Run Remix-IDE and point to your local folder

```shell script
docker-compose up
```

Go to [http://localhost:8080](http://localhost:8080), and choose
`--connect to localhost--` in the "Workspaces" dropdown menu within "File Explorers".

# References or Useful Links

- Diamond Standard for upgradeability
  - Started from the reference implementation [here](https://github.com/mudgen/diamond-1) which was refactored
  - The features of this repo are on a single facet in [BarnFacet.sol](./contracts/facets/BarnFacet.sol)
