var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports =
{
	networks:
	{
		docker:
		{
			host:       "iexec-geth-local",
			port:       8545,
			network_id: "*",         // Match any network id,
			gasPrice:   22000000000, //22Gwei
		},
		development:
		{
			host:       "localhost",
			port:       8545,
			network_id: "*",         // Match any network id,
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
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.MAINNET_NODE),
			network_id: '1',
			gasPrice:   22000000000, //22Gwei
		},
		ropsten:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.ROPSTEN_NODE),
			network_id: '3',
			gasPrice:   22000000000, //22Gwei
		},
		rinkeby:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.RINKEBY_NODE),
			network_id: '4',
			gasPrice:   22000000000, //22Gwei
		},
		goerli:
		{
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.GOERLI_NODE),
			network_id: '5',
			gasPrice:   22000000000, //22Gwei
		},
		kovan: {
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.KOVAN_NODE),
			network_id: '42',
			gasPrice:   10000000000, //10Gwei
		},
		viviani: {
			provider: () => new HDWalletProvider(process.env.DEPLOYER_MNEMONIC, process.env.VIVIANI_NODE),
			network_id: '133',
			gasPrice:   1000000000, //1Gwei
			gas:        6000000,
		}
	},
	compilers: {
		solc: {
			version: "0.5.11",
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
