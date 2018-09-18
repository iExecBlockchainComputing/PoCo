module.exports = {
	port: 8555,
	testCommand: 'truffle test --network coverage',
	norpc: false,
	copyPackages: ['rlc-token'],
	skipFiles: [
		'tools/Migrations.sol',
		'Beacon.sol',
		'Broker.sol',
	]
};
