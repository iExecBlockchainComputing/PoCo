const ethUtil = require("ethereumjs-util");

module.exports = {

	EIP712DOMAIN_SEPARATOR: null,
	   EIP712DOMAIN_TYPEHASH:  web3.utils.keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
	       APPORDER_TYPEHASH:     web3.utils.keccak256("AppOrder(address app,uint256 appprice,uint256 volume,uint256 tag,address datasetrestrict,address workerpoolrestrict,address userrestrict,bytes32 salt)"),
	   DATASETORDER_TYPEHASH:     web3.utils.keccak256("DatasetOrder(address dataset,uint256 datasetprice,uint256 volume,uint256 tag,address apprestrict,address workerpoolrestrict,address userrestrict,bytes32 salt)"),
	WORKERPOOLORDER_TYPEHASH:     web3.utils.keccak256("WorkerpoolOrder(address workerpool,uint256 workerpoolprice,uint256 volume,uint256 tag,uint256 category,uint256 trust,address apprestrict,address datasetrestrict,address userrestrict,bytes32 salt)"),
	      USERORDER_TYPEHASH:     web3.utils.keccak256("UserOrder(address app,uint256 appmaxprice,address dataset,uint256 datasetmaxprice,address workerpool,uint256 workerpoolmaxprice,address requester,uint256 volume,uint256 tag,uint256 category,uint256 trust,address beneficiary,address callback,string params,bytes32 salt)"),

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
	AppOrderStructHash: function(apporder)
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
			this.APPORDER_TYPEHASH,
			apporder.app,
			apporder.appprice,
			apporder.volume,
			apporder.tag,
			apporder.datasetrestrict,
			apporder.workerpoolrestrict,
			apporder.userrestrict,
			apporder.salt,
		]));
	},
	DatasetOrderStructHash: function(datasetorder)
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
			this.DATASETORDER_TYPEHASH,
			datasetorder.dataset,
			datasetorder.datasetprice,
			datasetorder.volume,
			datasetorder.tag,
			datasetorder.apprestrict,
			datasetorder.workerpoolrestrict,
			datasetorder.userrestrict,
			datasetorder.salt,
		]));
	},
	WorkerpoolOrderStructHash: function(workerpoolorder)
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
			this.WORKERPOOLORDER_TYPEHASH,
			workerpoolorder.workerpool,
			workerpoolorder.workerpoolprice,
			workerpoolorder.volume,
			workerpoolorder.tag,
			workerpoolorder.category,
			workerpoolorder.trust,
			workerpoolorder.apprestrict,
			workerpoolorder.datasetrestrict,
			workerpoolorder.userrestrict,
			workerpoolorder.salt,
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
			userorder.app,
			userorder.appmaxprice,
			userorder.dataset,
			userorder.datasetmaxprice,
			userorder.workerpool,
			userorder.workerpoolmaxprice,
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
	signAppOrder:        function(apporder,        key    ) { return this.signStruct (apporder,        this.AppOrderStructHash       (apporder),        key    ); },
	signDatasetOrder:    function(datasetorder,    key    ) { return this.signStruct (datasetorder,    this.DatasetOrderStructHash   (datasetorder),    key    ); },
	signWorkerpoolOrder: function(workerpoolorder, key    ) { return this.signStruct (workerpoolorder, this.WorkerpoolOrderStructHash(workerpoolorder), key    ); },
	signUserOrder:       function(userorder,       key    ) { return this.signStruct (userorder,       this.UserOrderStructHash      (userorder),       key    ); },
	signAuthorization:   function(authorization,   address) { return this.signMessage(authorization,   this.authorizationHash        (authorization),   address); },
	signContribution:    function(contribution,    address) { return this.signMessage(contribution,    this.contributionHash         (contribution ),   address); },

	hashByteResult: function(taskid, byteresult)
	{
		return {
			digest: byteresult,
			hash:   web3.utils.soliditySha3({ t: 'bytes32', v: taskid  }, { t: 'bytes32', v: byteresult }),
		};
	},

	sealByteResult: function(taskid, byteresult, address)
	{
		return {
			digest: byteresult,
			hash:   web3.utils.soliditySha3(                              { t: 'bytes32', v: taskid }, { t: 'bytes32', v: byteresult }),
			seal:   web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: taskid }, { t: 'bytes32', v: byteresult }),
		};
	},
	hashResult: function(taskid, result)          { return this.hashByteResult(taskid, web3.utils.soliditySha3({t: 'string', v: result })         ); },
	sealResult: function(taskid, result, address) { return this.sealByteResult(taskid, web3.utils.soliditySha3({t: 'string', v: result }), address); },

};
