module.exports = {
    /**
     * See https://github.com/sc-forks/solidity-coverage/issues/715 issue if
     * coverage is 0% when IR enabled.
     */
    configureYulOptimizer: true,
    solcOptimizerDetails: {
        yul: true,
        yulDetails: {
            optimizerSteps: '',
        },
    },
    mocha: {
        timeout: 600000, // double timeout
    },
    skipFiles: ['tools/'],
    istanbulFolder: './coverage',
};
