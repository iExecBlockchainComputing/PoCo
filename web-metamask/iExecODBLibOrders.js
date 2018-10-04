var iExecODBLibOrders =
{
	DOMAIN:
	{
		name:              "iExecODB",
		version:           "3.0-alpha",
		chainId:           3,
		verifyingContract: "0xBfBfD8ABc99fA00Ead2C46879A7D06011CbA73c5",
	},

	TYPES:
	{
		EIP712Domain: [
			{ name: "name",              type: "string"  },
			{ name: "version",           type: "string"  },
			{ name: "chainId",           type: "uint256" },
			{ name: "verifyingContract", type: "address" },
		],
		DappOrder: [
			{ name: "dapp",              type: "address" },
			{ name: "dappprice",         type: "uint256" },
			{ name: "volume",            type: "uint256" },
			{ name: "datarestrict",      type: "address" },
			{ name: "poolrestrict",      type: "address" },
			{ name: "userrestrict",      type: "address" },
			{ name: "salt",              type: "bytes32" },
		],
		DataOrder: [
			{ name: "data",              type: "address" },
			{ name: "dataprice",         type: "uint256" },
			{ name: "volume",            type: "uint256" },
			{ name: "dapprestrict",      type: "address" },
			{ name: "poolrestrict",      type: "address" },
			{ name: "userrestrict",      type: "address" },
			{ name: "salt",              type: "bytes32" },
		],
		PoolOrder: [
			{ name: "pool",              type: "address" },
			{ name: "poolprice",         type: "uint256" },
			{ name: "volume",            type: "uint256" },
			{ name: "category",          type: "uint256" },
			{ name: "trust",             type: "uint256" },
			{ name: "tag",               type: "uint256" },
			{ name: "dapprestrict",      type: "address" },
			{ name: "datarestrict",      type: "address" },
			{ name: "userrestrict",      type: "address" },
			{ name: "salt",              type: "bytes32" },
		],
		UserOrder: [
			{ name: "dapp",              type: "address" },
			{ name: "dappmaxprice",      type: "uint256" },
			{ name: "data",              type: "address" },
			{ name: "datamaxprice",      type: "uint256" },
			{ name: "pool",              type: "address" },
			{ name: "poolmaxprice",      type: "uint256" },
			{ name: "requester",         type: "address" },
			{ name: "volume",            type: "uint256" },
			{ name: "category",          type: "uint256" },
			{ name: "trust",             type: "uint256" },
			{ name: "tag",               type: "uint256" },
			{ name: "beneficiary",       type: "address" },
			{ name: "callback",          type: "address" },
			{ name: "params",            type: "string"  },
			{ name: "salt",              type: "bytes32" },
		],
	},

	signStruct: (typename, message, wallet, callback = null) =>
	{
		web3.currentProvider.sendAsync({
			method: "eth_signTypedData_v3",
			params: [ wallet, JSON.stringify({ types: iExecODBLibOrders.TYPES, domain: iExecODBLibOrders.DOMAIN, primaryType: typename, message: message }) ],
			from: wallet,
		}, (err, result) => {
			if (result.error == undefined)
			{
				const r = "0x" + result.result.substring(2, 66);
				const s = "0x" + result.result.substring(66, 130);
				const v = parseInt(result.result.substring(130, 132), 16);
				message.sign = { r: r, s: s, v: v };
				if (callback) { callback(message); }
			};
		});
	}

};
