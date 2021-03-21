import { NetworksUserConfig } from 'hardhat/types';
import { EtherscanConfig } from '@nomiclabs/hardhat-etherscan/dist/src/types';

export const networks: NetworksUserConfig = {
    // Needed for `solidity-coverage`
    coverage: {
        url: 'http://localhost:8555',
    },

    ganache: {
        url: 'http://localhost:7545',
        chainId: 5777,
        accounts: {
            mnemonic: 'adult chest ramp thank biology regular decide script position crop brush moral',
            path: "m/44'/60'/0'/0/account_index",
            initialIndex: 0,
            count: 10,
        },
        gas: 'auto',
        gasPrice: 20000000000, // 1 gwei
        gasMultiplier: 1.5,
    },
};

// Use to verify contracts on Etherscan
// https://buidler.dev/plugins/nomiclabs-buidler-etherscan.html
export const etherscan: EtherscanConfig = {
    apiKey: 'YOUR-ETHERSCAN-API-KEY',
};
