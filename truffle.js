var HDWalletProvider = require("@truffle/hdwallet-provider");

var useEnv = !!process.env.MNEMONIC && !!process.env.DEV_NODE;
console.log('useEnv', useEnv);

module.exports =
{
	plugins: [ "truffle-security", "solidity-coverage" ],
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
			provider: 	useEnv ? () => new HDWalletProvider(process.env.MNEMONIC, process.env.DEV_NODE) : undefined,
			host:       useEnv ? undefined : "localhost",
			port:       useEnv ? undefined : 8545,
			network_id: "*",
			gasPrice:   22000000000, //22Gwei
		},
		mainnet:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.MAINNET_NODE),
			network_id: '1',
			gasPrice:   22000000000, //22Gwei
		},
		ropsten:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.ROPSTEN_NODE),
			network_id: '3',
			gasPrice:   22000000000, //22Gwei
		},
		rinkeby:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.RINKEBY_NODE),
			network_id: '4',
			gasPrice:   22000000000, //22Gwei
		},
		goerli:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.GOERLI_NODE),
			network_id: '5',
			gasPrice:   22000000000, //22Gwei
		},
		kovan: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.KOVAN_NODE),
			network_id: '42',
			gasPrice:   10000000000, //10Gwei
		},
		viviani: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.VIVIANI_NODE),
			network_id: '133',
			gasPrice:   "0", //1Gwei
		},
		bellecour: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.BELLECOUR_NODE),
			network_id: '134',
			gasPrice:   "0", //1Gwei
		}
	},
	compilers: {
		solc: {
			version: "0.6.4",
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
