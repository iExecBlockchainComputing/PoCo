module.exports = {
	port: 8555,
	testrpcOptions: '-p 8555 -m "actual surround disorder swim upgrade devote digital misery truly verb slide final" -i 65535',
	testCommand: '../node_modules/.bin/truffle migrate --network coverage && ../node_modules/.bin/truffle test --network coverage',
	norpc: false,
	copyPackages: [
		'@ensdomains/ens',
		'@ensdomains/resolver',
		'iexec-solidity',
		'openzeppelin-solidity',
		'rlc-faucet-contract'
	],
	skipFiles: [
		'tools/Migrations.sol',
		'tools/TestClient.sol',
	]
};
