
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
		ropsten:
		{
			network_id: 3,
			host:       "localhost",
			port:       8545,
			gas:        8000000,
			gasPrice:   4000000000, //4Gwei
		},
		kovan:
		{
			network_id: 42,
			host:       "localhost",
			port:       8545,
			gas:        8000000,
			gasPrice:   1000000000, //1Gwei
		},
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
