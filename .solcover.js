const BASE_FOLDER = './coverage'

module.exports = {
    mocha: {
        timeout: 600000, // double timeout
    },
    skipFiles: [
        'tools/Migrations.sol',
        'tools/testing/TestClient.sol',
        'tools/testing/TestReceiver.sol',
    ],
    istanbulFolder: process.env.KYC? BASE_FOLDER + '/kyc' : BASE_FOLDER
};
