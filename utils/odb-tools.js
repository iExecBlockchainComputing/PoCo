module.exports = {

	EIP712DOMAIN_SEPARATOR: null,
	EIP712DOMAIN_TYPEHASH:  web3.utils.keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
	DAPPORDER_TYPEHASH:     web3.utils.keccak256("DappOrder(address dapp,uint256 dappprice,uint256 volume,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	DATAORDER_TYPEHASH:     web3.utils.keccak256("DataOrder(address data,uint256 dataprice,uint256 volume,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	POOLORDER_TYPEHASH:     web3.utils.keccak256("PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)"),
	USERORDER_TYPEHASH:     web3.utils.keccak256("UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)"),

	DomainStructHash: function(domain)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"bytes32",
			"bytes32",
			"uint256",
			"address",
		],[
			this.EIP712DOMAIN_TYPEHASH,
			web3.utils.keccak256(domain.name   ),
			web3.utils.keccak256(domain.version),
			domain.chainId,
			domain.verifyingContract,
		]));
	},
	DappOrderStructHash: function(dapporder)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([
			"bytes32",
			"address",
			"uint256",
			"uint256",
			"address",
			"address",
			"address",
			"bytes32",
		],[
			this.DAPPORDER_TYPEHASH,
			dapporder.dapp,
			dapporder.dappprice,
			dapporder.volume,
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
			"address",
			"address",
			"address",
			"bytes32",
		],[
			this.DATAORDER_TYPEHASH,
			dataorder.data,
			dataorder.dataprice,
			dataorder.volume,
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
			this.POOLORDER_TYPEHASH,
			poolorder.pool,
			poolorder.poolprice,
			poolorder.volume,
			poolorder.category,
			poolorder.trust,
			poolorder.tag,
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
			this.USERORDER_TYPEHASH,
			userorder.dapp,
			userorder.dappmaxprice,
			userorder.data,
			userorder.datamaxprice,
			userorder.pool,
			userorder.poolmaxprice,
			userorder.requester,
			userorder.volume,
			userorder.category,
			userorder.trust,
			userorder.tag,
			userorder.beneficiary,
			userorder.callback,
			web3.utils.keccak256(userorder.params),
			userorder.salt,
		]));
	},
	setup: function(domain)
	{
		this.EIP712DOMAIN_SEPARATOR = this.DomainStructHash(domain);
	},





	signObject: function(object, wallet, hashing)
	{
		return web3.eth.sign(hashing(object), wallet).then(function(signature) {
			object.sign = {
				r:             "0x" + signature.substr( 2, 64),
				s:             "0x" + signature.substr(66, 64),
				v: 27 + Number("0x" + signature.substr(    -2)),
			};
			return object
		});
	},
	getFullHash: function(iexecclerk, partialHash, salt)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: iexecclerk  },
			{ t: 'bytes32', v: partialHash },
			{ t: 'bytes32', v: salt        },
		);
	},
	dappPartialHash: function(dappmarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: dappmarket.dapp         },
			{ t: 'uint256', v: dappmarket.dappprice    },
			{ t: 'uint256', v: dappmarket.volume       },
			{ t: 'address', v: dappmarket.datarestrict },
			{ t: 'address', v: dappmarket.poolrestrict },
			{ t: 'address', v: dappmarket.userrestrict },
		);
	},
	dataPartialHash: function(datamarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: datamarket.data         },
			{ t: 'uint256', v: datamarket.dataprice    },
			{ t: 'uint256', v: datamarket.volume       },
			{ t: 'address', v: datamarket.dapprestrict },
			{ t: 'address', v: datamarket.poolrestrict },
			{ t: 'address', v: datamarket.userrestrict },
		);
	},
	poolPartialHash: function(poolmarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: poolmarket.pool         },
			{ t: 'uint256', v: poolmarket.poolprice    },
			{ t: 'uint256', v: poolmarket.volume       },
			{ t: 'uint256', v: poolmarket.category     },
			{ t: 'uint256', v: poolmarket.trust        },
			{ t: 'uint256', v: poolmarket.tag          },
			{ t: 'address', v: poolmarket.dapprestrict },
			{ t: 'address', v: poolmarket.datarestrict },
			{ t: 'address', v: poolmarket.userrestrict },
		);
	},
	userPartialHash: function(usermarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: usermarket.dapp         },
			{ t: 'uint256', v: usermarket.dappmaxprice },
			{ t: 'address', v: usermarket.data         },
			{ t: 'uint256', v: usermarket.datamaxprice },
			{ t: 'address', v: usermarket.pool         },
			{ t: 'uint256', v: usermarket.poolmaxprice },
			{ t: 'uint256', v: usermarket.volume       },
			{ t: 'uint256', v: usermarket.category     },
			{ t: 'uint256', v: usermarket.trust        },
			{ t: 'uint256', v: usermarket.tag          },
			{ t: 'address', v: usermarket.requester    },
			{ t: 'address', v: usermarket.beneficiary  },
			{ t: 'address', v: usermarket.callback     },
			{ t: 'string',  v: usermarket.params       },
		);
	},
	authorizeHash: function(authorization)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: authorization.worker  },
			{ t: 'bytes32', v: authorization.taskid  },
			{ t: 'address', v: authorization.enclave },
		);
	},
	contributionHash: function(result)
	{
		return web3.utils.soliditySha3(
			{ t: 'bytes32', v: result.contribution.hash },
			{ t: 'bytes32', v: result.contribution.sign },
		);
	},
	hashByteResult: function(byteresult)
	{
		return {
			base: byteresult,
			contribution: {
				hash: web3.utils.soliditySha3({ t: 'bytes32', v: byteresult })
			}
		};
	},
	signByteResult: function(byteresult, address)
	{
		return {
			base: byteresult,
			contribution: {
				hash: web3.utils.soliditySha3(                              { t: 'bytes32', v: byteresult }),
				sign: web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: byteresult })
			}
		};
	},
	hashResult: function(result)          { return this.hashByteResult(web3.utils.soliditySha3({t: 'string', v: result })         ); },
	signResult: function(result, address) { return this.signByteResult(web3.utils.soliditySha3({t: 'string', v: result }), address); },

};
