const Web3    = require("web3");
const ethUtil = require("ethereumjs-util");

module.exports = {

	EIP712DOMAIN_SEPARATOR: null,
//EIP712DOMAIN_TYPEHASH:  web3.utils.keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
	EIP712DOMAIN_TYPEHASH: '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f',
//DAPPORDER_TYPEHASH:     web3.utils.keccak256("DappOrder(address dapp,uint256 dappprice,uint256 volume,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	DAPPORDER_TYPEHASH: '0x54d6dfd5b0b205c769bfa2e658d0deb04041feb55aa2b45aa83254ecd37fec7f',
//DATAORDER_TYPEHASH:     web3.utils.keccak256("DataOrder(address data,uint256 dataprice,uint256 volume,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)"),
	DATAORDER_TYPEHASH: '0xe69a76440c3875f3ffb3612d713679e576cddc58f8dcb10bf74d1950f105c61b',
//POOLORDER_TYPEHASH:     web3.utils.keccak256("PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)"),
	POOLORDER_TYPEHASH: '0x83c35d50702bb5cd84ca58dcb61dbd00fb330c574f351202cdabc71a16642252',
//USERORDER_TYPEHASH:     web3.utils.keccak256("UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)"),
	USERORDER_TYPEHASH: '0x9cf6d00e15aa47bf59fe58f2b674c24c51a6942718b382678707689fe95c7185',

	setup: function(domain)
	{
		console.log("# iExec domain:", JSON.stringify(domain));
		this.EIP712DOMAIN_SEPARATOR = this.DomainStructHash(domain);
	},

	/* EIP712 compliant structure hashes */
	DomainStructHash: function(domain)
	{
		var _web3 = new Web3();
		return _web3.utils.keccak256(_web3.eth.abi.encodeParameters([
			"bytes32",
			"bytes32",
			"bytes32",
			"uint256",
			"address",
		],[
			this.EIP712DOMAIN_TYPEHASH,
			_web3.utils.keccak256(domain.name   ),
			_web3.utils.keccak256(domain.version),
			domain.chainId,
			domain.verifyingContract,
		]));
	},
	DappOrderStructHash: function(dapporder)
	{
		var _web3 = new Web3();
		return _web3.utils.keccak256(_web3.eth.abi.encodeParameters([
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
		var _web3 = new Web3();
		return _web3.utils.keccak256(_web3.eth.abi.encodeParameters([
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
		var _web3 = new Web3();
		return _web3.utils.keccak256(_web3.eth.abi.encodeParameters([
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
		var _web3 = new Web3();
		return _web3.utils.keccak256(_web3.eth.abi.encodeParameters([
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
			_web3.utils.keccak256(userorder.params),
			userorder.salt,
		]));
	},
	/* NOT EIP712 compliant */
	authorizationHash: function(authorization)
	{
		var _web3 = new Web3();
		return _web3.utils.soliditySha3(
			{ t: 'address', v: authorization.worker  },
			{ t: 'bytes32', v: authorization.taskid  },
			{ t: 'address', v: authorization.enclave },
		);
	},
	contributionHash: function(result)
	{
		var _web3 = new Web3();
		return _web3.utils.soliditySha3(
			{ t: 'bytes32', v: result.hash },
			{ t: 'bytes32', v: result.seal },
		);
	},

	/* signature schemes */
	signStruct: function(struct, hash, key)
	{
		var _web3 = new Web3();
		sig = ethUtil.ecsign(Buffer.from(_web3.utils.soliditySha3(
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
		var _web3 = new Web3(web3.currentProvider);
		return _web3.eth.sign(hash, wallet).then(function(signature) {
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
		var _web3 = new Web3();
		return {
			digest: byteresult,
			hash:   _web3.utils.soliditySha3({ t: 'bytes32', v: byteresult })
		};
	},
	sealByteResult: function(byteresult, address)
	{
		var _web3 = new Web3();
		return {
			digest: byteresult,
			hash:   _web3.utils.soliditySha3(                              { t: 'bytes32', v: byteresult }),
			seal:   _web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: byteresult })
		};
	},
	hashResult: function(result)
	{
		var _web3 = new Web3();
		return this.hashByteResult(_web3.utils.soliditySha3({t: 'string', v: result }));
	},
	sealResult: function(result, address)
	{
		var _web3 = new Web3();
		return this.sealByteResult(_web3.utils.soliditySha3({t: 'string', v: result }), address);
	},

};
