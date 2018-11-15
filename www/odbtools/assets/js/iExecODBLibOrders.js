var iExecODBLibOrders =
{
	DOMAIN:
	{
		name:              "iExecODB",
		version:           "3.0-alpha",
		chainId:           null,
		verifyingContract: null,
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
			{ name: "tag",               type: "uint256" },
			{ name: "datarestrict",      type: "address" },
			{ name: "poolrestrict",      type: "address" },
			{ name: "userrestrict",      type: "address" },
			{ name: "salt",              type: "bytes32" },
		],
		DataOrder: [
			{ name: "data",              type: "address" },
			{ name: "dataprice",         type: "uint256" },
			{ name: "volume",            type: "uint256" },
			{ name: "tag",               type: "uint256" },
			{ name: "dapprestrict",      type: "address" },
			{ name: "poolrestrict",      type: "address" },
			{ name: "userrestrict",      type: "address" },
			{ name: "salt",              type: "bytes32" },
		],
		PoolOrder: [
			{ name: "pool",              type: "address" },
			{ name: "poolprice",         type: "uint256" },
			{ name: "volume",            type: "uint256" },
			{ name: "tag",               type: "uint256" },
			{ name: "category",          type: "uint256" },
			{ name: "trust",             type: "uint256" },
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
			{ name: "tag",               type: "uint256" },
			{ name: "category",          type: "uint256" },
			{ name: "trust",             type: "uint256" },
			{ name: "beneficiary",       type: "address" },
			{ name: "callback",          type: "address" },
			{ name: "params",            type: "string"  },
			{ name: "salt",              type: "bytes32" },
		],
	},

	signStruct: (typename, message, wallet) =>
	{
		return new Promise((resolve, reject) => {
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
					resolve(message);
				}
				else
				{
					reject(result);
				}
			});
		});
	},

	isValidOrder: (type, order) =>
	{
		return iExecODBLibOrders.TYPES[type].every(v => order[v.name] !== undefined);
	},

	getOrderOwner: (order) =>
	{
		return new Promise((resolve, reject) => {
			if (iExecODBLibOrders.isValidOrder("DappOrder", order))
			{
				(new web3.eth.Contract(DappABI, order.dapp)).methods.m_owner().call().then(resolve);
			}
			else if (iExecODBLibOrders.isValidOrder("DataOrder", order))
			{
				(new web3.eth.Contract(DataABI, order.data)).methods.m_owner().call().then(resolve);
			}
			else if (iExecODBLibOrders.isValidOrder("PoolOrder", order))
			{
				(new web3.eth.Contract(PoolABI, order.pool)).methods.m_owner().call().then(resolve);
			}
			else if (iExecODBLibOrders.isValidOrder("UserOrder", order))
			{
				resolve(order.requester);
			}
			else
			{
				reject("Invalid order");
			}
		});
	},

	typeHash: (type) =>
	{
		return web3.utils.keccak256(type + "(" + iExecODBLibOrders.TYPES[type].map(o => o.type + " " + o.name).join(',') + ")");
	},

	DappOrderStructHash: function(dapporder)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"address",
			"uint256",
			"uint256",
			"uint256",
			"address",
			"address",
			"address",
			"bytes32",
		],[
			// iExecODBLibOrders.DAPPORDER_TYPEHASH,
			iExecODBLibOrders.typeHash("DappOrder"),
			dapporder.dapp,
			dapporder.dappprice,
			dapporder.volume,
			dapporder.tag,
			dapporder.datarestrict,
			dapporder.poolrestrict,
			dapporder.userrestrict,
			dapporder.salt,
		]));
	},
	DataOrderStructHash: function(dataorder)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"address",
			"uint256",
			"uint256",
			"uint256",
			"address",
			"address",
			"address",
			"bytes32",
		],[
			// iExecODBLibOrders.DATAORDER_TYPEHASH,
			iExecODBLibOrders.typeHash("DataOrder"),
			dataorder.data,
			dataorder.dataprice,
			dataorder.volume,
			dataorder.tag,
			dataorder.dapprestrict,
			dataorder.poolrestrict,
			dataorder.userrestrict,
			dataorder.salt,
		]));
	},
	PoolOrderStructHash: function(poolorder)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"address",
			"uint256",
			"uint256",
			"uint256",
			"uint256",
			"uint256",
			"address",
			"address",
			"address",
			"bytes32",
		],[
			// iExecODBLibOrders.POOLORDER_TYPEHASH,
			iExecODBLibOrders.typeHash("PoolOrder"),
			poolorder.pool,
			poolorder.poolprice,
			poolorder.volume,
			poolorder.tag,
			poolorder.category,
			poolorder.trust,
			poolorder.dapprestrict,
			poolorder.datarestrict,
			poolorder.userrestrict,
			poolorder.salt,
		]));
	},
	UserOrderStructHash: function(userorder)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"address",
			"uint256",
			"address",
			"uint256",
			"address",
			"uint256",
			"address",
			"uint256",
			"uint256",
			"uint256",
			"uint256",
			"address",
			"address",
			"bytes32",
			"bytes32",
		],[
			// iExecODBLibOrders.USERORDER_TYPEHASH,
			iExecODBLibOrders.typeHash("UserOrder"),
			userorder.dapp,
			userorder.dappmaxprice,
			userorder.data,
			userorder.datamaxprice,
			userorder.pool,
			userorder.poolmaxprice,
			userorder.requester,
			userorder.volume,
			userorder.tag,
			userorder.category,
			userorder.trust,
			userorder.beneficiary,
			userorder.callback,
			web3.utils.keccak256(userorder.params),
			userorder.salt,
		]));
	},

};
