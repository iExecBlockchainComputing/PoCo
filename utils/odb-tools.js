const ethUtil = require("ethereumjs-util");

module.exports = {

	EIP712DOMAIN_SEPARATOR: null,
	EIP712DOMAIN_TYPEHASH:  web3.utils.keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
	DAPPORDER_TYPEHASH:     web3.utils.keccak256("DappOrder(address dapp,uint256 dappprice,uint256 volume,uint256 tag,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	DATAORDER_TYPEHASH:     web3.utils.keccak256("DataOrder(address data,uint256 dataprice,uint256 volume,uint256 tag,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	POOLORDER_TYPEHASH:     web3.utils.keccak256("PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)"),
	USERORDER_TYPEHASH:     web3.utils.keccak256("UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)"),

	setup: function(domain)
	{
		console.log("# iExec domain:", JSON.stringify(domain));
		this.EIP712DOMAIN_SEPARATOR = this.DomainStructHash(domain);
	},

	/* EIP712 compliant structure hashes */
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
			this.DATAORDER_TYPEHASH,
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
			this.POOLORDER_TYPEHASH,
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
			this.USERORDER_TYPEHASH,
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
	/* NOT EIP712 compliant */
	authorizationHash: function(authorization)
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
			{ t: 'bytes32', v: result.hash },
			{ t: 'bytes32', v: result.seal },
		);
	},

	/* signature schemes */
	signStruct: function(struct, hash, key)
	{
		sig = ethUtil.ecsign(Buffer.from(web3.utils.soliditySha3(
			{ t: 'bytes',   v: "0x1901"                    },
			{ t: 'bytes32', v: this.EIP712DOMAIN_SEPARATOR },
			{ t: 'bytes32', v: hash                        },
		).substr(2), 'hex'), key);
		struct.sign = {
			r: ethUtil.bufferToHex(sig.r),
			s: ethUtil.bufferToHex(sig.s),
			v: sig.v,
		}
		return struct;
	},
	signMessage: function(obj, hash, wallet)
	{
		return web3.eth.sign(hash, wallet).then(function(signature) {
			obj.sign = {
				r:             "0x" + signature.substr( 2, 64),
				s:             "0x" + signature.substr(66, 64),
				v: 27 + Number("0x" + signature.substr(    -2)),
			};
			return obj
		});
	},

	/* wrappers */
	signDappOrder:     function(dapporder,     key    ) { return this.signStruct (dapporder,     this.DappOrderStructHash(dapporder),     key    ); },
	signDataOrder:     function(dataorder,     key    ) { return this.signStruct (dataorder,     this.DataOrderStructHash(dataorder),     key    ); },
	signPoolOrder:     function(poolorder,     key    ) { return this.signStruct (poolorder,     this.PoolOrderStructHash(poolorder),     key    ); },
	signUserOrder:     function(userorder,     key    ) { return this.signStruct (userorder,     this.UserOrderStructHash(userorder),     key    ); },
	signAuthorization: function(authorization, address) { return this.signMessage(authorization, this.authorizationHash  (authorization), address); },
	signContribution:  function(contribution,  address) { return this.signMessage(contribution,  this.contributionHash   (contribution ), address); },




	hashByteResult: function(byteresult)
	{
		return {
			digest: byteresult,
			hash:   web3.utils.soliditySha3({ t: 'bytes32', v: byteresult })
		};
	},
	sealByteResult: function(byteresult, address)
	{
		return {
			digest: byteresult,
			hash:   web3.utils.soliditySha3(                              { t: 'bytes32', v: byteresult }),
			seal:   web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: byteresult })
		};
	},
	hashResult: function(result)          { return this.hashByteResult(web3.utils.soliditySha3({t: 'string', v: result })         ); },
	sealResult: function(result, address) { return this.sealByteResult(web3.utils.soliditySha3({t: 'string', v: result }), address); },

};
