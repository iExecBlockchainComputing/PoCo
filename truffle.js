var HDWalletProvider = require("@truffle/hdwallet-provider");

var useEnv = !!process.env.MNEMONIC;

module.exports =
{
	plugins:
	[
		"solidity-coverage",
		"truffle-plugin-verify"
	],
	api_keys:
	{
		etherscan: process.env.ETHERSCAN
	},
	networks:
	{
		docker:
		{
			host:       "iexec-geth-local",
			port:       8545,
			network_id: "*",        // Match any network id,
			gasPrice:   "8000000000", // 8 Gwei
		},
		development:
		{
			provider:   useEnv ? () => new HDWalletProvider(process.env.MNEMONIC, process.env.DEV_NODE || "http://localhost:8545") : undefined,
			host:       useEnv ? undefined : "localhost",
			port:       useEnv ? undefined : 8545,
			network_id: "*",
			gasPrice:   "8000000000", // 8 Gwei
			disableConfirmationListener: true,
		},
		mainnet:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.MAINNET_NODE),
			network_id: "1",
			gasPrice:   "100000000000", // 100 Gwei
			disableConfirmationListener: true,
		},
		ropsten:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.ROPSTEN_NODE),
			network_id: "3",
			gasPrice:   "8000000000", // 8 Gwei
			disableConfirmationListener: true,
		},
		rinkeby:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.RINKEBY_NODE),
			network_id: "4",
			gasPrice:   "8000000000", // 8 Gwei
			disableConfirmationListener: true,
		},
		goerli:
		{
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.GOERLI_NODE),
			network_id: "5",
			gasPrice:   "8000000000", // 8 Gwei
			disableConfirmationListener: true,
		},
		kovan: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.KOVAN_NODE),
			network_id: "42",
			gasPrice:   "8000000000", // 8 Gwei
			disableConfirmationListener: true,
		},
		viviani: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.VIVIANI_NODE),
			network_id: "133",
			gasPrice:   "0", // 0 Gwei
			gas:        "6700000",
			disableConfirmationListener: true,
		},
		bellecour: {
			provider: () => new HDWalletProvider(process.env.MNEMONIC, process.env.BELLECOUR_NODE),
			network_id: "134",
			gasPrice:   "0", // 0 Gwei
			gas:        "6700000",
			disableConfirmationListener: true,
		}
	},
	compilers: {
		solc: {
			version: "0.6.12",
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
