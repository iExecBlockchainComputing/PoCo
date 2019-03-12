const ethUtil = require("ethereumjs-util");

module.exports = {

	EIP712DOMAIN_SEPARATOR: null,
	EIP712DOMAIN_TYPEHASH:    web3.utils.keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
	APPORDER_TYPEHASH:        web3.utils.keccak256("AppOrder(address app,uint256 appprice,uint256 volume,bytes32 tag,address datasetrestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)"),
	DATASETORDER_TYPEHASH:    web3.utils.keccak256("DatasetOrder(address dataset,uint256 datasetprice,uint256 volume,bytes32 tag,address apprestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)"),
	WORKERPOOLORDER_TYPEHASH: web3.utils.keccak256("WorkerpoolOrder(address workerpool,uint256 workerpoolprice,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address apprestrict,address datasetrestrict,address requesterrestrict,bytes32 salt)"),
	REQUESTORDER_TYPEHASH:    web3.utils.keccak256("RequestOrder(address app,uint256 appmaxprice,address dataset,uint256 datasetmaxprice,address workerpool,uint256 workerpoolmaxprice,address requester,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address beneficiary,address callback,string params,bytes32 salt)"),

	setup: function(domain)
	{
		console.log("# iExec domain:", JSON.stringify(domain));
		this.EIP712DOMAIN_SEPARATOR = this.DomainStructHash(domain);
		console.log("EIP712DOMAIN_SEPARATOR:", this.EIP712DOMAIN_SEPARATOR);
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
			apporder.requesterrestrict,
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
			datasetorder.requesterrestrict,
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
			workerpoolorder.requesterrestrict,
			workerpoolorder.salt,
		]));
	},
	RequestOrderStructHash: function(requestorder)
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
			this.REQUESTORDER_TYPEHASH,
			requestorder.app,
			requestorder.appmaxprice,
			requestorder.dataset,
			requestorder.datasetmaxprice,
			requestorder.workerpool,
			requestorder.workerpoolmaxprice,
			requestorder.requester,
			requestorder.volume,
			requestorder.tag,
			requestorder.category,
			requestorder.trust,
			requestorder.beneficiary,
			requestorder.callback,
			web3.utils.keccak256(requestorder.params),
			requestorder.salt,
		]));
	},
	typedStructHash: function(hash)
	{
		return web3.utils.soliditySha3(
			{ t: 'bytes',   v: "0x1901"                    },
			{ t: 'bytes32', v: this.EIP712DOMAIN_SEPARATOR },
			{ t: 'bytes32', v: hash                        },
		)
	},

	AppOrderTypedStructHash:        function (order) { return this.typedStructHash(this.AppOrderStructHash       (order)); },
	DatasetOrderTypedStructHash:    function (order) { return this.typedStructHash(this.DatasetOrderStructHash   (order)); },
	WorkerpoolOrderTypedStructHash: function (order) { return this.typedStructHash(this.WorkerpoolOrderStructHash(order)); },
	RequestOrderTypedStructHash:    function (order) { return this.typedStructHash(this.RequestOrderStructHash   (order)); },

	/* NOT EIP712 compliant */
	authorizationHash: function(authorization)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: authorization.worker  },
			{ t: 'bytes32', v: authorization.taskid  },
			{ t: 'address', v: authorization.enclave },
		);
	},
	/* NOT EIP712 compliant */
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
		sig = ethUtil.ecsign(Buffer.from(hash.substr(2), 'hex'), key);
		struct.sign = '0x' +
		[ ethUtil.bufferToHex(sig.r).substr(2)
		, ethUtil.bufferToHex(sig.s).substr(2)
		, ethUtil.bufferToHex(sig.v).substr(2)
		].join('');
		return struct;
	},

	signMessage: function(obj, hash, wallet)
	{
		return web3.eth.sign(hash, wallet).then(function(signature) {
			obj.sign = signature;
			return obj
		});
	},

	/* wrappers */
	signAppOrder:        function(apporder,        key    ) { return this.signStruct (apporder,        this.AppOrderTypedStructHash       (apporder),        key    ); },
	signDatasetOrder:    function(datasetorder,    key    ) { return this.signStruct (datasetorder,    this.DatasetOrderTypedStructHash   (datasetorder),    key    ); },
	signWorkerpoolOrder: function(workerpoolorder, key    ) { return this.signStruct (workerpoolorder, this.WorkerpoolOrderTypedStructHash(workerpoolorder), key    ); },
	signRequestOrder:    function(requestorder,    key    ) { return this.signStruct (requestorder,    this.RequestOrderTypedStructHash   (requestorder),    key    ); },
	signAuthorization:   function(authorization,   address) { return this.signMessage(authorization,   this.authorizationHash             (authorization),   address); },
	signContribution:    function(contribution,    address) { return this.signMessage(contribution,    this.contributionHash              (contribution ),   address); },

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
