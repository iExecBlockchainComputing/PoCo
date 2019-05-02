var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports =
{
	networks:
	{
		docker:
		{
			network_id: "*", // Match any network id,
			host:       "iexec-geth-local",
			port:       8545,
			gas:        8000000,
			gasPrice:   22000000000,
		},
		development:
		{
			network_id: "*", // Match any network id,
			host:       "localhost",
			port:       8545,
			gas:        8000000,
			gasPrice:   1000000000, //1Gwei
		},
		coverage:
		{
			network_id: "*",
			host:       "localhost",
			port:       8555,            // <-- If you change this, also set the port option in .solcover.js.
			gas:        0xFFFFFFFFFFF, // <-- Use this high gas value
			gasPrice:   0x01        // <-- Use this low gas price
		},
		mainnet:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.MAINNET_NODE),//"https://kovan.infura.io/v3/b2fd33d1c9cc440ba84752c2a4cf949d"
			network_id: 1,
			gas:        8000000,
			gasPrice:   4000000000, //4Gwei
		},
		kovan: {
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.KOVAN_NODE),//"https://kovan.infura.io/v3/b2fd33d1c9cc440ba84752c2a4cf949d"
			network_id: '42',
			gas:        8000000,
			gasPrice:   10000000000, //10Gwei
		}
	},
	compilers: {
		solc: {
			version: "0.5.7",
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
