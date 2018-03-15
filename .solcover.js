module.exports = {
    port: 8555,
    testrpcOptions: '-p 8555',
    testCommand: 'truffle test test/* --network coverage',
    norpc: false,
    copyPackages: ['rlc-token'],
    skipFiles: ['Migrations.sol',]
};
