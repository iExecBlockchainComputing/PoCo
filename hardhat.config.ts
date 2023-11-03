import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-truffle5';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import { HardhatUserConfig } from 'hardhat/config';
import {
    HARDHAT_NETWORK_MNEMONIC,
    defaultHardhatNetworkParams,
    defaultLocalhostNetworkParams,
} from 'hardhat/internal/core/config/default-config';

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
    evmVersion: 'paris',
};

const zeroGasPrice = 0; // 0 Gwei. No EIP-1559 on Bellecour (Production sidechain).
const envOrHardhatMnemonic = process.env.MNEMONIC || HARDHAT_NETWORK_MNEMONIC;

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
            /**
             * Starting from Hardhat v2.14.0, Shanghai is the default hardfork
             * used by the Hardhat Network. This fork is not compatible with the
             * iExec Bellecour blockchain.
             */
            hardfork: 'merge',
            accounts: {
                mnemonic: envOrHardhatMnemonic,
            },
        },
        'external-hardhat': {
            chainId: defaultHardhatNetworkParams.chainId,
            url: defaultLocalhostNetworkParams.url,
            accounts: {
                mnemonic: envOrHardhatMnemonic,
            },
        },
        'dev-native': {
            chainId: 65535,
            url: process.env.DEV_NODE || 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: zeroGasPrice, // Get closer to Bellecour network
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
                    browserURL: 'https://blockscout.viviani.iex.ec/',
                },
            },
            {
                network: 'bellecour',
                chainId: 134,
                urls: {
                    apiURL: 'https://blockscout.bellecour.iex.ec/api',
                    browserURL: 'https://blockscout.bellecour.iex.ec/',
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
            '@iexec/erlc/contracts/ERLCTokenSwap.sol',
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
        ],
        keep: true, // Slither requires compiled dependencies
    },
};

export default config;
