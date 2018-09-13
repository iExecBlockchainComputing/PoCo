module.exports = {
	port: 8555,
	testrpcOptions: '-p 8555 -l 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF -g 0x1',
	testCommand: 'truffle test --network coverage',
	norpc: false,
	copyPackages: ['rlc-token'],
	skipFiles: ['Migrations.sol',]
};
