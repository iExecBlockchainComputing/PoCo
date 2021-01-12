const fs = require("fs");

module.exports = {
	client: require('ganache-cli'),
	/*
	 * providerOptions: {
	 *	hardfork: "istanbul",
	 *	mnemonic: "actual surround disorder swim upgrade devote digital misery truly verb slide final",
	 *	network_id: 65535
	 * },
	 */
	port: 8555,
	skipFiles: [
		'tools/Migrations.sol',
		'tools/testing/TestClient.sol',
		'tools/testing/TestReceiver.sol',
	],
	onCompileComplete: () => {
		files = [
			{ repo: 'rlc-faucet-contract',  name: 'RLC'                   },
			{ repo: '@ensdomains/ens',      name: 'ENSRegistry'           },
			{ repo: '@ensdomains/ens',      name: 'FIFSRegistrar'         },
			{ repo: '@ensdomains/ens',      name: 'ReverseRegistrar'      },
			{ repo: '@ensdomains/resolver', name: 'PublicResolver'        },
			{ repo: '@iexec/erlc',          name: 'ERLCSwap'              },
			{ repo: '@iexec/solidity',      name: 'ERC1538Proxy'          },
			{ repo: '@iexec/solidity',      name: 'ERC1538UpdateDelegate' },
			{ repo: '@iexec/solidity',      name: 'ERC1538QueryDelegate'  },
			{ repo: '@iexec/solidity',      name: 'GenericFactory'        },
		];
		for (file of files)
		{
			fs.copyFileSync(`node_modules/${file.repo}/build/contracts/${file.name}.json`, `.coverage_artifacts/contracts/${file.name}.json`);
		}
	}
};
