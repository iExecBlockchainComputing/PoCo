import '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import 'dotenv/config';
import 'hardhat-deploy';
// hardhat-dependency-compiler temporarily disabled - not compatible with Hardhat 3 yet
// import 'hardhat-dependency-compiler';
// solidity-docgen temporarily disabled - not compatible with Hardhat 3 yet
// import 'solidity-docgen';
import type { HardhatUserConfig } from 'hardhat/config';
import { task } from 'hardhat/config';
import chainConfig from './utils/config';

// Hardhat 3: default mnemonic for hardhat network
const HARDHAT_NETWORK_MNEMONIC = 'test test test test test test test test test test test junk';

const isNativeChainType = chainConfig.isNativeChain();
const isLocalFork = chainConfig.isLocalFork();
const isArbitrumSepoliaFork = chainConfig.isArbitrumSepoliaFork();
const isArbitrumFork = chainConfig.isArbitrumFork();
const bellecourBlockscoutUrl = 'https://blockscout.bellecour.iex.ec';

/**
 * @dev Native mode. As close as possible to the iExec Bellecour blockchain.
 * @note Any fresh version of Hardhat uses for its default
 * hardhat network a configuration from a recent Ethereum
 * fork. EIPs brought by such recent fork are not necessarily
 * supported by the iExec Bellecour blockchain.
 */
const bellecourBaseConfig = {
    hardfork: 'berlin', // No EIP-1559 before London fork
    gasPrice: 0,
    blockGasLimit: 6_700_000,
};

// Arbitrum Sepolia specific configuration
const arbitrumSepoliaBaseConfig = {
    chainId: 421614,
    blockGasLimit: 32_000_000,
};

// Arbitrum specific configuration
const arbitrumBaseConfig = {
    chainId: 42161,
    // https://docs.arbitrum.io/build-decentralized-apps/arbitrum-vs-ethereum/block-numbers-and-time#block-gas-limit
    blockGasLimit: 32_000_000,
};

function _getPrivateKeys() {
    const ZERO_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || ZERO_PRIVATE_KEY;
    const adminKey = process.env.ADMIN_PRIVATE_KEY || ZERO_PRIVATE_KEY;
    return [deployerKey, adminKey];
}

const config: HardhatUserConfig = {
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.21',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                        details: {
                            yul: true,
                            yulDetails: {
                                optimizerSteps: 'u',
                            },
                        },
                    },
                    outputSelection: { '*': { '*': ['storageLayout'] } },
                    viaIR: true,
                },
            }, // PoCo Boost
            {
                version: '0.6.12',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    outputSelection: { '*': { '*': ['storageLayout'] } },
                },
            }, // PoCo contracts
            {
                version: '0.4.11',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    outputSelection: { '*': { '*': ['storageLayout'] } },
                },
            }, // RLC contracts
        ],
    },
    // @ts-expect-error - namedAccounts is provided by hardhat-deploy but types are not yet updated for Hardhat v3
    namedAccounts: {
        deployer: {
            default: 0,
            bellecour: chainConfig.chains['134'].deployer,
            arbitrum: chainConfig.chains['42161'].deployer,
            arbitrumSepolia: chainConfig.chains['421614'].deployer,
        },
        owner: {
            default: 0, // TODO change this to 1 and update admin tests.
            bellecour: chainConfig.chains['134'].owner,
            arbitrum: chainConfig.chains['42161'].owner,
            arbitrumSepolia: chainConfig.chains['421614'].owner,
        },
    },
    networks: {
        hardhat: {
            type: 'edr-simulated',
            accounts: {
                mnemonic: process.env.MNEMONIC || HARDHAT_NETWORK_MNEMONIC,
            },
            ...((isNativeChainType || isLocalFork) && bellecourBaseConfig),
            ...(isLocalFork && {
                forking: {
                    url: 'https://bellecour.iex.ec',
                },
                chainId: 134,
            }),
            ...(isArbitrumSepoliaFork && {
                forking: {
                    url:
                        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
                        'https://sepolia-rollup.arbitrum.io/rpc',
                    blockNumber: process.env.ARBITRUM_SEPOLIA_BLOCK_NUMBER
                        ? parseInt(process.env.ARBITRUM_SEPOLIA_BLOCK_NUMBER)
                        : undefined,
                },
                ...arbitrumSepoliaBaseConfig,
                gasPrice: 100_000_000, // 0.1 Gwei
            }),
            ...(isArbitrumFork && {
                forking: {
                    url: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.gateway.tenderly.co',
                },
                ...arbitrumBaseConfig,
                gasPrice: 100_000_000, // 0.1 Gwei
            }),
        },
        'external-hardhat': {
            type: 'edr-simulated',
            accounts: {
                mnemonic: process.env.MNEMONIC || HARDHAT_NETWORK_MNEMONIC,
            },
            ...((isNativeChainType || isLocalFork) && bellecourBaseConfig),
            ...(isLocalFork && {
                // Impersonation works automatically with forking in Hardhat v3
                chainId: 134,
            }),
            ...(isArbitrumSepoliaFork && {
                // Impersonation works automatically with forking in Hardhat v3
                ...arbitrumSepoliaBaseConfig,
            }),
            ...(isArbitrumFork && {
                // Impersonation works automatically with forking in Hardhat v3
                ...arbitrumBaseConfig,
            }),
        },
        'dev-native': {
            type: 'http',
            chainId: 65535,
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: bellecourBaseConfig.gasPrice, // Get closer to Bellecour network
        },
        'dev-token': {
            type: 'http',
            chainId: 65535,
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            // When deploying on a blockchain with EIP-1559 enabled and
            // force-sealing disabled, deployment gets stuck if gasPrice is
            // not manually set. Other approaches might be considered here.
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        arbitrum: {
            type: 'http',
            url:
                process.env.ARBITRUM_RPC_URL || // Used in local development
                process.env.RPC_URL || // Defined in Github Actions environments
                'https://arbitrum.gateway.tenderly.co',
            accounts: _getPrivateKeys(),
            ...arbitrumBaseConfig,
        },
        arbitrumSepolia: {
            type: 'http',
            url:
                process.env.ARBITRUM_SEPOLIA_RPC_URL || // Used in local development
                process.env.RPC_URL || // Defined in Github Actions environments
                'https://sepolia-rollup.arbitrum.io/rpc',
            accounts: _getPrivateKeys(),
            ...arbitrumSepoliaBaseConfig,
        },
        bellecour: {
            type: 'http',
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: _getPrivateKeys(),
            ...bellecourBaseConfig,
            // verify configuration is in etherscan section below
        },
    },
    etherscan: {
        // Using Etherscan V2 API for unified multichain support
        apiKey: process.env.EXPLORER_API_KEY || '',
        customChains: [
            {
                network: 'bellecour',
                chainId: 134,
                urls: {
                    apiURL: `${bellecourBlockscoutUrl}/api`,
                    browserURL: bellecourBlockscoutUrl,
                },
            },
        ],
    },
    sourcify: {
        enabled: true,
    },
    typechain: {
        outDir: 'typechain',
    },
    mocha: { timeout: 300000 },
};

/**
 * Override `test` task to copy deployments of Arbitrum Sepolia if running tests on
 * a forked Arbitrum Sepolia network and clean them up afterwards.
 * Uses Hardhat v3 task API with lazy-loaded action file.
 */
task('test', 'Run tests with deployment copying for forks').setAction(
    () => import('./tasks/test.js'),
);

export default config;
