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
import chainConfig from './utils/config';

const isNativeChainType = chainConfig.isNativeChain();
const isLocalFork = process.env.LOCAL_FORK == 'true';
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
    /**
     * @dev The 0.8.20 compiler switches the default target EVM version to Shanghai.
     * At this time, the iExec Bellecour blockchain does not support new OPCODES
     * brought by the Shanghai fork, hence the target must be lowered.
     */
    evmVersion: bellecourBaseConfig.hardfork,
};

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            { version: '0.8.21', settings: v8Settings }, // PoCo Boost (and ENS contracts >=0.8.4)
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
            //TODO: Refactor
            forking: {
                url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_PRIVATE_KEY}`,
            },
            chainId: 11155111,
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
            chainId: 11155111,
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            // When deploying on a blockchain with EIP-1559 enabled and
            // force-sealing disabled, deployment gets stuck if gasPrice is
            // not manually set. Other approaches might be considered here.
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        // live networks
        mainnet: {
            chainId: 1,
            url: process.env.MAINNET_NODE || '',
            accounts: {
                mnemonic: process.env.PROD_MNEMONIC || '',
            },
        },
        goerli: {
            chainId: 5,
            url: process.env.GOERLI_NODE || '',
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
            ...bellecourBaseConfig,
        },
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: [
                process.env.PROD_PRIVATE_KEY ||
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
    typechain: {
        outDir: 'typechain',
    },
    dependencyCompiler: {
        paths: [
            'rlc-faucet-contract/contracts/RLC.sol',
            '@iexec/solidity/contracts/ERC1538/ERC1538Modules/ERC1538Update.sol',
            '@iexec/solidity/contracts/ERC1538/ERC1538Modules/ERC1538Query.sol',
            '@iexec/solidity/contracts/ERC1538/ERC1538Proxy/ERC1538Proxy.sol',
            // ENS
            '@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol',
            '@ensdomains/ens-contracts/contracts/registry/FIFSRegistrar.sol',
            '@ensdomains/ens-contracts/contracts/registry/ReverseRegistrar.sol',
            '@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol',
            // Used as mock or fake in UTs
            '@openzeppelin/contracts-v5/interfaces/IERC1271.sol',
            // Used in deployment
            '@amxx/factory/contracts/v6/GenericFactory.sol',
        ],
        keep: true, // Slither requires compiled dependencies
    },
    docgen: {
        outputDir: 'docs/solidity',
        templates: 'docs/solidity/templates',
        exclude: [
            'external',
            'modules/delegates/IexecAccessorsABILegacyDelegate.sol', // not relevant
            'modules/delegates/IexecEscrowTokenSwapDelegate.sol', // not relevant
            'modules/delegates/SignatureVerifier.sol', // contains only internal/private
            'modules/delegates/SignatureVerifier.v8.sol',
            'modules/interfaces', // interesting for events but too much doc duplication if enabled
            'registries', // ignore them for now
            'tools',
            'IexecInterfaceNativeABILegacy.sol', // ignore interfaces
            'IexecInterfaceTokenABILegacy.sol',
            'IexecInterfaceNative.sol',
            'IexecInterfaceToken.sol',
            'Store.sol', // almost empty
            'Store.v8.sol',
        ],
    },
    mocha: { timeout: 50000 },
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

export default config;
