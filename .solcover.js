module.exports = {
	port: 8555,
	testCommand: 'truffle test --network coverage',
	norpc: false,
	copyPackages: ['rlc-token'],
	skipFiles: [
		'IexecHub.sol',
		'IexecClerk.sol',
		'tools/Migrations.sol',
	]
};
