# SoV-Reign Contracts

This repo has all smart contracts used by SoV-Reign.

The `./contracts` folder has the following structure:

- `./`: the root folder should contain all entrypoint contracts
- `./governance/`
- `./tokens/`
- `./pool/`
- `./periphery/`: oracles, basket balancer, interest strategy, etc.
- `./staking/`

- `./mocks/`
- `./interfaces/`
- `./libraries/`
- `./facets/`


## Contract's Architecture

TBD

## Development

### Dependencies

* node v12.10
* docker
* docker-compose
* TBD

### Build & Test Instructions

```shell script
yarn install
yarn test
```

### Deploy in testnet

* Just deploy all contracts:

```shell script
hardhat run scripts/run-deploy-all.ts
```

* Run the `scenario1`:

```shell script
hardhat run scripts/run-scenario1.ts
```

### Run Remix-IDE and point to your local folder

```shell script
docker-compose up
```

Go to [http://localhost:8080](http://localhost:8080), and choose 
`--connect to localhost--` in the "Workspaces" dropdown menu within "File Explorers".

## References or Useful Links

- Diamond Standard for upgradeability
  * Started from the reference implementation [here](https://github.com/mudgen/diamond-1) which was refactored
  * The features of this repo are on a single facet in [BarnFacet.sol](./contracts/facets/BarnFacet.sol)