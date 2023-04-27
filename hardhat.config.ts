import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-dependency-compiler';
import '@nomiclabs/hardhat-truffle5';

const settings = {
    optimizer: {
        enabled: true,
        runs: 200,
    }
}

const zeroGasPrice = 0 // 0 Gwei. No EIP-1559 on Bellecour (Production sidechain).

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            { version: '0.8.19', settings }, // ENS contracts
            { version: '0.6.12', settings }, // PoCo contracts
            { version: '0.4.11', settings }, // RLC contracts
        ],
    },
    networks: {
        // dev networks: Get closer to Bellecour network
        docker: {
            url: process.env.DOCKER_NODE || 'http://localhost:8545',
            gasPrice: zeroGasPrice,
        },
        dev: {
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: zeroGasPrice,
        },
        // live networks
        mainnet: {
            chainId: 1,
            url: process.env.MAINNET_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
        },
        ropsten: {
            chainId: 3,
            url: process.env.ROPSTEN_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
        },
        rinkeby: {
            chainId: 4,
            url: process.env.RINKEBY_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
        },
        goerli: {
            chainId: 5,
            url: process.env.GOERLI_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
        },
        kovan: {
            chainId: 42,
            url: process.env.KOVAN_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
        },
        viviani: {
            chainId: 133,
            url: 'https://viviani.iex.ec',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: zeroGasPrice,
            gas: 6700000,
        },
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: zeroGasPrice,
            gas: 6700000,
        },
    },
    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API_KEY || '',
            viviani: 'nothing', // a non-empty string is needed by the plugin.
            bellecour: 'nothing', // a non-empty string is needed by the plugin.
        },
        customChains: [
            {
                network: 'viviani',
                chainId: 133,
                urls: {
                    apiURL: 'https://blockscout.viviani.iex.ec/api',
                    browserURL: 'https://blockscout.viviani.iex.ec/'
                }
            },
            {
                network: 'bellecour',
                chainId: 134,
                urls: {
                    apiURL: 'https://blockscout.bellecour.iex.ec/api',
                    browserURL: 'https://blockscout.bellecour.iex.ec/'
                }
            },
        ]
    },
    typechain: {
        outDir: 'typechain'
    },
    dependencyCompiler: {
        paths: [
            'rlc-faucet-contract/contracts/RLC.sol',
            '@iexec/erlc/contracts/ERLCTokenSwap.sol',
            '@iexec/solidity/contracts/ERC1538/ERC1538Modules/ERC1538Update.sol',
            '@iexec/solidity/contracts/ERC1538/ERC1538Modules/ERC1538Query.sol',
            // Latest iexec-solidity is required
            // Contracts can be imported:
            // 1. From local clone
            // cd iexec-solidity && npm link
            // cd PoCo-dev && npm i && npm link @iexec/solidity
            // See https://stackoverflow.com/a/72015226
            // 2. Or From Github
            // npm i https://github.com/iExecBlockchainComputing/iexec-solidity#<commit>
            '@iexec/solidity/contracts/ERC1538/ERC1538Proxy/ERC1538Proxy.sol',
            // ENS
            '@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol',
            '@ensdomains/ens-contracts/contracts/registry/FIFSRegistrar.sol',
            '@ensdomains/ens-contracts/contracts/registry/ReverseRegistrar.sol',
            '@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol',
        ],
    }
};

export default config;
