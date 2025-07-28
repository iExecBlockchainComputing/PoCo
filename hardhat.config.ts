import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';
import * as fs from 'fs';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import { HardhatUserConfig, task } from 'hardhat/config';
import {
    HARDHAT_NETWORK_MNEMONIC,
    defaultHardhatNetworkParams,
    defaultLocalhostNetworkParams,
} from 'hardhat/internal/core/config/default-config';
import 'solidity-docgen';
import { cleanupDeployments, copyDeployments } from './scripts/tools/copy-deployments';
import chainConfig from './utils/config';

const isNativeChainType = chainConfig.isNativeChain();
const isLocalFork = process.env.LOCAL_FORK == 'true';
const isFujiFork = process.env.FUJI_FORK == 'true';
const isArbitrumSepoliaFork = process.env.ARBITRUM_SEPOLIA_FORK == 'true';
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

// Avalanche Fuji specific configuration
const fujiBaseConfig = {
    gasPrice: 25_000_000_000, // 25 Gwei default
    blockGasLimit: 8_000_000,
    chainId: 43113,
};

// Arbitrum Sepolia specific configuration
const arbitrumSepoliaBaseConfig = {
    gasPrice: 100_000_000, // 0.1 Gwei default (Arbitrum has lower gas prices)
    blockGasLimit: 30_000_000, // Arbitrum has higher block gas limits
    chainId: 421614,
};

const settings = {
    optimizer: {
        enabled: true,
        runs: 200,
    },
    outputSelection: { '*': { '*': ['storageLayout'] } },
};

const v8Settings = {
    ...settings,
    /**
     * Enable Intermediate Representation (IR) to reduce `Stack too deep` occurrences
     * at compile time (e.g.: too many local variables in `matchOrdersBoost`).
     * https://hardhat.org/hardhat-runner/docs/reference/solidity-support#support-for-ir-based-codegen
     */
    viaIR: true,
    optimizer: {
        ...settings.optimizer,
        details: {
            yul: true,
            yulDetails: {
                optimizerSteps: 'u',
            },
        },
    },
};

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            { version: '0.8.21', settings: v8Settings }, // PoCo Boost
            { version: '0.6.12', settings }, // PoCo contracts
            { version: '0.4.11', settings }, // RLC contracts
        ],
    },
    networks: {
        hardhat: {
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
            ...(isFujiFork && {
                forking: {
                    url: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
                    blockNumber: process.env.FUJI_BLOCK_NUMBER
                        ? parseInt(process.env.FUJI_BLOCK_NUMBER)
                        : undefined,
                },
                ...fujiBaseConfig,
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
            }),
        },
        'external-hardhat': {
            ...defaultHardhatNetworkParams,
            ...defaultLocalhostNetworkParams,
            accounts: {
                mnemonic: process.env.MNEMONIC || HARDHAT_NETWORK_MNEMONIC,
            },
            ...((isNativeChainType || isLocalFork) && bellecourBaseConfig),
            ...(isLocalFork && {
                accounts: 'remote', // Override defaults accounts for impersonation
                chainId: 134,
            }),
            ...(isFujiFork && {
                accounts: 'remote', // Override defaults accounts for impersonation
                ...fujiBaseConfig,
            }),
            ...(isArbitrumSepoliaFork && {
                accounts: 'remote', // Override defaults accounts for impersonation
                ...arbitrumSepoliaBaseConfig,
            }),
        },
        'dev-native': {
            chainId: 65535,
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: bellecourBaseConfig.gasPrice, // Get closer to Bellecour network
        },
        'dev-token': {
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
        avalancheFujiTestnet: {
            url:
                process.env.FUJI_RPC_URL || // Used in local development
                process.env.RPC_URL || // Defined in Github Actions environments
                'https://api.avax-test.network/ext/bc/C/rpc',
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY ||
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            ...fujiBaseConfig,
        },
        arbitrumSepolia: {
            url:
                process.env.ARBITRUM_SEPOLIA_RPC_URL || // Used in local development
                process.env.RPC_URL || // Defined in Github Actions environments
                'https://sepolia-rollup.arbitrum.io/rpc',
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY ||
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            ...arbitrumSepoliaBaseConfig,
        },
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY ||
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            ...bellecourBaseConfig,
            verify: {
                etherscan: {
                    apiUrl: bellecourBlockscoutUrl,
                    apiKey: '<>',
                },
            },
        },
    },
    etherscan: {
        // TODO migrate to Etherscan V2 API and use process.env.EXPLORER_API_KEY
        apiKey: {
            avalancheFujiTestnet: 'nothing', // a non-empty string is needed by the plugin.
            arbitrumSepolia: process.env.ARBISCAN_API_KEY || '',
            bellecour: 'nothing', // a non-empty string is needed by the plugin.
        },
        customChains: [
            {
                network: 'viviani',
                chainId: 133,
                urls: {
                    apiURL: 'https://blockscout.viviani.iex.ec/api',
                    browserURL: 'https://blockscout.viviani.iex.ec/',
                },
            },
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
    dependencyCompiler: {
        paths: [
            'rlc-faucet-contract/contracts/RLC.sol',
            // ERC-2535 Diamond
            '@mudgen/diamond-1/contracts/facets/DiamondCutFacet.sol',
            '@mudgen/diamond-1/contracts/facets/DiamondLoupeFacet.sol',
            '@mudgen/diamond-1/contracts/facets/OwnershipFacet.sol',
            '@mudgen/diamond-1/contracts/libraries/LibDiamond.sol',
            '@mudgen/diamond-1/contracts/upgradeInitializers/DiamondInit.sol',
            // Used as mock or fake in UTs
            '@openzeppelin/contracts-v5/interfaces/IERC1271.sol',
            // Used in deployment
            '@amxx/factory/contracts/v6/GenericFactory.sol',
            'createx/src/ICreateX.sol',
        ],
        keep: true, // Slither requires compiled dependencies
    },
    docgen: {
        outputDir: 'docs/solidity',
        templates: 'docs/solidity/templates',
        exclude: [
            'external',
            'facets/IexecAccessorsABILegacyFacet.sol', // not relevant
            'facets/IexecEscrowTokenSwapFacet.sol', // not relevant
            'facets/SignatureVerifier.sol', // contains only internal/private
            'facets/SignatureVerifier.v8.sol',
            'interfaces', // interesting for events but too much doc duplication if enabled
            'registries', // ignore them for now
            'tools',
            'Store.sol', // almost empty
            'Store.v8.sol',
        ],
    },
    mocha: { timeout: 300000 },
};

/**
 * Ignore doc generation of contracts compiled with solc@0.4 (unsupported by docgen).
 */
task('docgen').setAction(async (taskArgs, hre, runSuper) => {
    const ignoredSuffix = '.docgen-ignored';
    const ignoredPaths: string[] = [];
    for (const path of await hre.artifacts.getBuildInfoPaths()) {
        const solcVersion: string = JSON.parse(fs.readFileSync(path, 'utf8')).solcVersion;
        if (solcVersion.startsWith('0.4')) {
            fs.renameSync(path, path + ignoredSuffix); // mark as docgen ignored
            ignoredPaths.push(path);
        }
    }
    await runSuper(taskArgs).finally(() => {
        for (const path of ignoredPaths) {
            fs.renameSync(path + ignoredSuffix, path); // restore build info as before
        }
    });
});

task('test').setAction(async (taskArgs: any, hre, runSuper) => {
    let deploymentsCopied = false;
    let networkName = '';
    try {
        if (process.env.ARBITRUM_SEPOLIA_FORK === 'true') {
            networkName = 'arbitrumSepolia';
            deploymentsCopied = await copyDeployments(networkName);
        } else if (process.env.FUJI_FORK === 'true') {
            networkName = 'avalancheFujiTestnet';
            deploymentsCopied = await copyDeployments(networkName);
        }
        await runSuper(taskArgs);
    } finally {
        if (deploymentsCopied && networkName) {
            await cleanupDeployments(networkName);
        }
    }
});

export default config;
