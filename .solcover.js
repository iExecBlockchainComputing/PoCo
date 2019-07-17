module.exports = {
	port: 8555,
	testrpcOptions: '-p 8555 -l 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF -g 0x1 -m "actual surround disorder swim upgrade devote digital misery truly verb slide final" -i 1544020727674',
	testCommand: 'truffle test --network coverage',
	norpc: true,
	copyPackages: [
		'@ensdomains/ens',
		'iexec-solidity',
		'openzeppelin-solidity',
		'rlc-faucet-contract'
	],
	skipFiles: [
		'registries/AppRegistry.sol',
		'registries/DatasetRegistry.sol',
		'registries/WorkerpoolRegistry.sol',
		'tools/Migrations.sol',
		'tools/TestClient.sol',
	]
};
