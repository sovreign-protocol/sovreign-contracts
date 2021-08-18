![Build and Test](https://github.com/dialecticch/sovreign-contracts/actions/workflows/build.yml/badge.svg?branch=master)

# 👑 Sovreign: Contracts 👑

This repo has all smart contracts used by Sovreign.

The `./contracts` folder has the following structure:

- `./facets/`: contains the Diamond Facets utilized
- `./farming/`: contains all yield-farming contracts as well as the main staking vault
- `./governance/`: contains contracts related to the ReignDAO, the Diamond set-up, and Governance Rewards
- `./interfaces/`: contains all interfaces used across the protocol
- `./libraries/`: contains all libraries
- `./mocks/`: contains mock contracts used for testing
- `./tokens/`: contains the SOV and REIGN Token contracts
- `./vesting/`: contains vesting contracts for the team and early investors
- `./wrapper/`: contains all functionality related to wrapping the Balancer LP into SVR

## solc

This project is using the solidity compiler version 0.7.6

## Dependencies

- node v14.14
- hardhat v2.
- openzeppelin-contracts v3.2.2-solc-0.7
- docker
- docker-compose

## Commands

### Install dependencies

```shell script
yarn install
```

### Compile

```shell script
yarn compile
```

### Test

```shell script
yarn test
```

### Test Single

```shell script
yarn test ./test/<TestName>.test.ts
```

### Coverage

```shell script
yarn coverage
```

## Deployment

> **IMPORTANT:**
>
> The following env variables can be set:
> - `TAG`
> - `MAINNET_FORKING_ENABLED`
> - `MAINNET_URL`
> - `RINKEBY_URL`
> - `ETHERSCAN_API_KEY`
>
>  By default, the `MAINNET_FORKING_ENABLED` is set to `true` in `.env` file. It means that
> hardhat uses mainnet forking for running the scripts and tests.

- Just deploy and set-up all contracts:

```shell script
npx hardhat run scripts/run-deploy-all.ts
```

- Run the `scenario1`:

```shell script
npx hardhat run ./scripts/run-scenario1.ts
```

## Run Remix-IDE and point to your local folder

```shell script
docker-compose up
```

Go to [http://localhost:8080](http://localhost:8080), and choose
`--connect to localhost--` in the "Workspaces" dropdown menu within "File Explorers".

## Acknowledgement

This repository was composed being based on the following repositories:

- [BarnBridge/BarnBridge-DAO](https://github.com/BarnBridge/BarnBridge-DAO), more specifically from [this commit](https://github.com/BarnBridge/BarnBridge-DAO/tree/efbcc08282279c15a6d82908618f9279e14f22a2).
- [BarnBridge/BarnBridge-Barn](https://github.com/BarnBridge/BarnBridge-Barn), more specifically from [this commit](https://github.com/BarnBridge/BarnBridge-Barn/tree/1634b6b011f7ca1134ab66ef04c69217e1fa609e).
- [BarnBridge/BarnBridge-YieldFarming](https://github.com/BarnBridge/BarnBridge-YieldFarming), more specifically from [this commit](https://github.com/BarnBridge/BarnBridge-YieldFarming/tree/848330d25d2544c179a107584293bce03b71d13c).

We're pretty thankful for their hard work! 👏 🚀

Modifications from the original work can be found in subsequent commits on this repository, made by the [Sovreign Team](https://sovreign.org). 🙏

## License

Licensed under the Apache2 License.

See [LICENSE](LICENSE) for more information.

---

Made with :heart: by [Sovreign Team](https://sovreign.org)
