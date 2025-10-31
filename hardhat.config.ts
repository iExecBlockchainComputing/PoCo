import type { HardhatUserConfig } from 'hardhat/config';

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
};

export default config;
