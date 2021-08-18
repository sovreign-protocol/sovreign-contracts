import {NetworksUserConfig} from 'hardhat/types';
import {EtherscanConfig} from '@nomiclabs/hardhat-etherscan/dist/src/types';
import * as dotenv from 'dotenv'

dotenv.config();

const defaultAccount = {
    mnemonic: "test test test test test test test test test test test junk",
    initialIndex: 0,
    path: "m/44'/60'/0'/0",
    count: 20,
    accountsBalance: "10000000000000000000000"
}

const defaultAccountRinkeby = {
    mnemonic: "cave grief nephew there cry isolate find brief burst into mesh catch",
    initialIndex: 0,
    path: "m/44'/60'/0'/0",
    count: 20,
    accountsBalance: "10000000000000000000000"
}

export const networks: NetworksUserConfig = {
    // Needed for `solidity-coverage`
    coverage: {
        url: 'http://localhost:8555',
    },

    ganache: {
        url: 'http://localhost:7545',
        chainId: 5777,
        accounts: defaultAccount,
        gas: 'auto',
        gasPrice: 20000000000, // 1 gwei
        gasMultiplier: 1.5,
    },

    rinkeby: {
        url: getRinkebyURL(),
        accounts: defaultAccountRinkeby,
        gas: 'auto',
        hardfork: 'london'
    },

    hardhat: {
        accounts: defaultAccount,
        mining: {
            auto: true
        },
        hardfork: 'london',
        forking: {
            url: getMainnetURL(),
            enabled: isForkingEnabled()
        }
    },
};

// Use to verify contracts on Etherscan
// https://buidler.dev/plugins/nomiclabs-buidler-etherscan.html
export const etherscan: EtherscanConfig = {
    apiKey: getEtherscanAPIKey(),
};

function getRinkebyURL(): string {
    return process.env.RINKEBY_URL || "http://localhost:8545";
}

function getMainnetURL(): string {
    return process.env.MAINNET_URL || "http://localhost:8545";
}

function isForkingEnabled(): boolean {
    return (process.env.MAINNET_FORKING_ENABLED) ? (process.env.MAINNET_FORKING_ENABLED == "true") : false
}

function getEtherscanAPIKey(): string {
    return process.env.ETHERSCAN_API_KEY || "";
}
