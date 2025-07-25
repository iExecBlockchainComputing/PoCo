const BASE_FOLDER = './coverage';

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
    skipFiles: [
        'tools/Migrations.sol',
        'tools/testing/ERC734Mock.sol',
        'tools/testing/ERC1271Mock.sol',
        'tools/testing/TestClient.sol',
        'tools/testing/TestReceiver.sol',
        'modules/facets/SignatureVerifierFacet.sol',
    ],
    istanbulFolder: BASE_FOLDER,
};
