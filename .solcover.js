module.exports = {
    mocha: {
        timeout: 600000, // double timeout
    },
    skipFiles: [
        'tools/Migrations.sol',
        'tools/testing/TestClient.sol',
        'tools/testing/TestReceiver.sol',
    ],
};
