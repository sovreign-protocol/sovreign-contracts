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

    hardhat: {
        accounts: defaultAccount,
        forking: {
            // I know, I know. Not a good practice to add tokens to git repos.
            // For development, I don't care. :-)
            url: "https://eth-mainnet.alchemyapi.io/v2/-g51O7AhTJD5wgzNee3y1ksKDaQqM4Fy",
            enabled: (process.env.MAINNET_ALCHEMY_ENABLED) ? (process.env.MAINNET_ALCHEMY_ENABLED == "true") : false
        }
    },
};

// Use to verify contracts on Etherscan
// https://buidler.dev/plugins/nomiclabs-buidler-etherscan.html
export const etherscan: EtherscanConfig = {
    apiKey: 'YOUR-ETHERSCAN-API-KEY',
};
