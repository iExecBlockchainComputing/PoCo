module.exports = {
	port: 8555,
	testrpcOptions: '-p 8555 -m "actual surround disorder swim upgrade devote digital misery truly verb slide final" -i 1544020727674',
	testCommand: 'truffle migrate --network coverage && truffle test --network coverage',
	norpc: false,
	copyPackages: [
		'@ensdomains/ens',
		'iexec-solidity',
		'openzeppelin-solidity',
		'rlc-faucet-contract'
	],
	skipFiles: [
		'tools/Migrations.sol',
		'tools/TestClient.sol',
	]
};
