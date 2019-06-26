var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports =
{
	networks:
	{
		docker:
		{
			host:       "iexec-geth-local",
			port:       8545,
			network_id: "*", // Match any network id,
			gasPrice:   22000000000, //22Gwei
		},
		development:
		{
			host:       "localhost",
			port:       8545,
			network_id: "*", // Match any network id,
			gasPrice:   22000000000, //22Gwei
		},
		coverage:
		{
			host:       "localhost",
			port:       8555,          // <-- If you change this, also set the port option in .solcover.js.
			network_id: "*",
			gas:        0xFFFFFFFFFFF, // <-- Use this high gas value
			gasPrice:   0x01           // <-- Use this low gas price
		},
		mainnet:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.KOVAN_NODE),
			network_id: '1',
			gasPrice:   22000000000, //22Gwei
		},
		ropsten:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.KOVAN_NODE),
			network_id: '3',
			gasPrice:   22000000000, //22Gwei
		},
		kovan: {
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.KOVAN_NODE),
			network_id: '42',
			gasPrice:   10000000000, //10Gwei
		}
	},
	compilers: {
		solc: {
			version: "0.5.10",
			settings: {
				optimizer: {
					enabled: true,
					runs: 200
				}
			}
		}
	},
	mocha:
	{
		enableTimeouts: false
	}
};
