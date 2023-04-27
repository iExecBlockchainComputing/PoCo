import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-dependency-compiler";


const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.4.11", // RLC contracts
            },
            {
                version: "0.6.12", // PoCo contracts
            }
        ],
        settings: {
            optimizer: {
                // enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        // dev networks
        docker: {
            url: process.env.DOCKER_NODE || "http://localhost:8545",
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        dev: {
            url: process.env.DEV_NODE || "http://localhost:8545",
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        // live networks
        mainnet: {
            chainId: 1,
            url: process.env.MAINNET_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 100_000_000_000, // 100 Gwei
        },
        ropsten: {
            chainId: 3,
            url: process.env.ROPSTEN_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        rinkeby: {
            chainId: 4,
            url: process.env.RINKEBY_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        goerli: {
            chainId: 5,
            url: process.env.GOERLI_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        kovan: {
            chainId: 42,
            url: process.env.KOVAN_NODE || '',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 8_000_000_000, // 8 Gwei
        },
        viviani: {
            chainId: 133,
            url: 'https://viviani.iex.ec',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 0, // 0 Gwei
            gas: 6700000,
        },
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 0, // 0 Gwei
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
                network: "viviani",
                chainId: 133,
                urls: {
                    apiURL: "https://blockscout.viviani.iex.ec/api",
                    browserURL: "https://blockscout.viviani.iex.ec/"
                }
            },
            {
                network: "bellecour",
                chainId: 134,
                urls: {
                    apiURL: "https://blockscout.bellecour.iex.ec/api",
                    browserURL: "https://blockscout.bellecour.iex.ec/"
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
        ],
    }
};

export default config;
