
module.exports =
{
	networks:
	{
		docker:
		{
			host: "iexec-geth-local",
			port: 8545,
			network_id: "*", // Match any network id,
			gas: 4710000,
			gasPrice: 22000000000,
		},
		development:
		{
			host: "localhost",
			port: 8545,
			network_id: "*", // Match any network id,
			gas: 4710000,
			gasPrice: 8000000000,
		},
		coverage:
		{
			host: "localhost",
			network_id: "*",
			port: 8555,            // <-- If you change this, also set the port option in .solcover.js.
			gas: 0xFFFFFFFFFFF, // <-- Use this high gas value
			gasPrice: 0x01        // <-- Use this low gas price
		},
		ropsten:
		{
			network_id: 3,
			host: "localhost",
			port:  8545,
			gas: 4710000,
			gasPrice: 22000000000,
		},
	},
	solc:
	{
		optimizer:
		{
			enabled: true,
			runs: 200
		}
	},
	mocha:
	{
		enableTimeouts: false
	}
};
