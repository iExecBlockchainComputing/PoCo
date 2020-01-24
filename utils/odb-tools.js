const ethUtil   = require('ethereumjs-util');
const sigUtil   = require('eth-sig-util');
const constants = require('./constants');

const TYPES =
{
	EIP712Domain: [
		{ name: "name",              type: "string"  },
		{ name: "version",           type: "string"  },
		{ name: "chainId",           type: "uint256" },
		{ name: "verifyingContract", type: "address" },
	],
	AppOrder: [
		{ type: "address", name: "app"                },
		{ type: "uint256", name: "appprice"           },
		{ type: "uint256", name: "volume"             },
		{ type: "bytes32", name: "tag"                },
		{ type: "address", name: "datasetrestrict"    },
		{ type: "address", name: "workerpoolrestrict" },
		{ type: "address", name: "requesterrestrict"  },
		{ type: "bytes32", name: "salt"               },
	],
	DatasetOrder: [
		{ type: "address", name: "dataset"            },
		{ type: "uint256", name: "datasetprice"       },
		{ type: "uint256", name: "volume"             },
		{ type: "bytes32", name: "tag"                },
		{ type: "address", name: "apprestrict"        },
		{ type: "address", name: "workerpoolrestrict" },
		{ type: "address", name: "requesterrestrict"  },
		{ type: "bytes32", name: "salt"               },
	],
	WorkerpoolOrder: [
		{ type: "address", name:"workerpool"          },
		{ type: "uint256", name:"workerpoolprice"     },
		{ type: "uint256", name:"volume"              },
		{ type: "bytes32", name:"tag"                 },
		{ type: "uint256", name:"category"            },
		{ type: "uint256", name:"trust"               },
		{ type: "address", name:"apprestrict"         },
		{ type: "address", name:"datasetrestrict"     },
		{ type: "address", name:"requesterrestrict"   },
		{ type: "bytes32", name:"salt"                },
	],
	RequestOrder: [
		{ type: "address", name: "app"                },
		{ type: "uint256", name: "appmaxprice"        },
		{ type: "address", name: "dataset"            },
		{ type: "uint256", name: "datasetmaxprice"    },
		{ type: "address", name: "workerpool"         },
		{ type: "uint256", name: "workerpoolmaxprice" },
		{ type: "address", name: "requester"          },
		{ type: "uint256", name: "volume"             },
		{ type: "bytes32", name: "tag"                },
		{ type: "uint256", name: "category"           },
		{ type: "uint256", name: "trust"              },
		{ type: "address", name: "beneficiary"        },
		{ type: "address", name: "callback"           },
		{ type: "string",  name: "params"             },
		{ type: "bytes32", name: "salt"               },
	],
	AppOrderOperation: [
		{ type: "AppOrder",        name: "order"     },
		{ type: "uint256",         name: "operation" },
	],
	DatasetOrderOperation: [
		{ type: "DatasetOrder",    name: "order"     },
		{ type: "uint256",         name: "operation" },
	],
	WorkerpoolOrderOperation: [
		{ type: "WorkerpoolOrder", name: "order"     },
		{ type: "uint256",         name: "operation" },
	],
	RequestOrderOperation: [
		{ type: "RequestOrder",    name: "order"     },
		{ type: "uint256",         name: "operation" },
	],
}

function signStruct(primaryType, message, domain, pk)
{
	message.sign = sigUtil.signTypedData(
		pk,
		{
			data:
			{
				types: TYPES,
				primaryType,
				message,
				domain,
			}
		}
	);
	return message;
}

function hashStruct(primaryType, message, domain)
{
	return ethUtil.bufferToHex(sigUtil.TypedDataUtils.sign({
		types: TYPES,
		primaryType,
		message,
		domain,
	}));
}

function signMessage(obj, hash, wallet)
{
	if (wallet.sign)
	{
		obj.sign = wallet.sign(hash).signature;
		return obj;
	}
	else
	{
		return web3.eth.sign(hash, wallet).then(sign => {
			obj.sign = sign;
			return obj;
		});
	}
}

/* NOT EIP712 compliant */
function hashAuthorization(authorization)
{
	return web3.utils.soliditySha3(
		{ t: 'address', v: authorization.worker  },
		{ t: 'bytes32', v: authorization.taskid  },
		{ t: 'address', v: authorization.enclave },
	);
}

/* NOT EIP712 compliant */
function hashContribution(result)
{
	return web3.utils.soliditySha3(
		{ t: 'bytes32', v: result.hash },
		{ t: 'bytes32', v: result.seal },
	);
}

function signAuthorization(obj, wallet)
{
	return signMessage(obj, hashAuthorization(obj), wallet);
}

function signContribution(obj, wallet)
{
	return signMessage(obj, hashContribution (obj), wallet);
}

function hashByteResult(taskid, byteresult)
{
	return {
		digest: byteresult,
		hash:   web3.utils.soliditySha3({ t: 'bytes32', v: taskid  }, { t: 'bytes32', v: byteresult }),
	};
}

function sealByteResult(taskid, byteresult, address)
{
	return {
		digest: byteresult,
		hash:   web3.utils.soliditySha3(                              { t: 'bytes32', v: taskid }, { t: 'bytes32', v: byteresult }),
		seal:   web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: taskid }, { t: 'bytes32', v: byteresult }),
	};
}

function hashResult(taskid, result)
{
	return hashByteResult(taskid, web3.utils.soliditySha3({t: 'string', v: result }));
}

function sealResult(taskid, result, address)
{
	return sealByteResult(taskid, web3.utils.soliditySha3({t: 'string', v: result }), address);
}

async function requestToDeal(IexecClerk, requestHash)
{
	let idx     = 0;
	let dealids = [];
	while (true)
	{
		let dealid = web3.utils.soliditySha3({ t: 'bytes32', v: requestHash }, { t: 'uint256', v: idx });
		let deal = await IexecClerk.viewDeal(dealid);
		if (deal.botSize == 0)
		{
			return dealids;
		}
		else
		{
			dealids.push(dealid);
			idx += deal.botSize;
		}
	}
}
/*****************************************************************************
 *                               MOCK SCHEDULER                              *
 *****************************************************************************/
class MockScheduler
{
	constructor(wallet)
	{
		this.wallet = wallet;
	}
	async signPreAuthorization(taskid, worker)
	{
		return await signAuthorization({ taskid, worker, enclave: constants.NULL.ADDRESS }, this.wallet);
	}
}
/*****************************************************************************
 *                                MOCK BROKER                                *
 *****************************************************************************/
class MockBroker
{
	constructor(IexecInstance)
	{
		this.iexec  = IexecInstance;
	}

	async initialize()
	{
		this.wallet = web3.eth.accounts.create();
		await this.iexec.setTeeBroker(this.wallet.address);
	}

	async signAuthorization(preauth)
	{
		const task   = await this.iexec.viewTask(preauth.taskid);
		const deal   = await this.iexec.viewDeal(task.dealid);
		const signer = web3.eth.accounts.recover(hashAuthorization(preauth), preauth.sign);
		if (signer == deal.workerpool.owner)
		{
			const enclaveWallet = web3.eth.accounts.create();
			const auth = await signAuthorization({ ...preauth, enclave: enclaveWallet.address }, this.wallet);
			return [ auth, enclaveWallet ];
		}
		else
		{
			return [ null, null ];
		}
	}
}
/*****************************************************************************
 *                                MOCK WORKER                                *
 *****************************************************************************/
class MockWorker
{
	constructor(wallet)
	{
		this.wallet = wallet;
	}

	async run(auth, enclaveWallet, result)
	{
		const contribution = sealResult(auth.taskid, result, this.wallet);
		if (auth.enclave == constants.NULL.ADDRESS) // Classic
		{
			contribution.sign = constants.NULL.SIGNATURE;
		}
		else // TEE
		{
			await signContribution(contribution, enclaveWallet);
		}
		return contribution;
	}
}

/*****************************************************************************
 *                                  MODULE                                   *
 *****************************************************************************/
module.exports = {
	/* mocks */
	MockScheduler,
	MockBroker,
	MockWorker,
	/* utils */
	utils: {
		signStruct,
		hashStruct,
		signMessage,
		hashAuthorization,
		hashContribution,
		signAuthorization,
		signContribution,
		hashByteResult,
		sealByteResult,
		hashResult,
		hashConsensus: hashResult,
		sealResult,
		requestToDeal,
	},
	/* wrappers */
	hashAppOrder:                 function(domain, struct    ) { return hashStruct("AppOrder",                 struct, domain     ); },
	hashDatasetOrder:             function(domain, struct    ) { return hashStruct("DatasetOrder",             struct, domain     ); },
	hashWorkerpoolOrder:          function(domain, struct    ) { return hashStruct("WorkerpoolOrder",          struct, domain     ); },
	hashRequestOrder:             function(domain, struct    ) { return hashStruct("RequestOrder",             struct, domain     ); },
	hashAppOrderOperation:        function(domain, struct    ) { return hashStruct("AppOrderOperation",        struct, domain     ); },
	hashDatasetOrderOperation:    function(domain, struct    ) { return hashStruct("DatasetOrderOperation",    struct, domain     ); },
	hashWorkerpoolOrderOperation: function(domain, struct    ) { return hashStruct("WorkerpoolOrderOperation", struct, domain     ); },
	hashRequestOrderOperation:    function(domain, struct    ) { return hashStruct("RequestOrderOperation",    struct, domain     ); },
	signAppOrder:                 function(domain, struct, pk) { return signStruct("AppOrder",                 struct, domain, pk ); },
	signDatasetOrder:             function(domain, struct, pk) { return signStruct("DatasetOrder",             struct, domain, pk ); },
	signWorkerpoolOrder:          function(domain, struct, pk) { return signStruct("WorkerpoolOrder",          struct, domain, pk ); },
	signRequestOrder:             function(domain, struct, pk) { return signStruct("RequestOrder",             struct, domain, pk ); },
	signAppOrderOperation:        function(domain, struct, pk) { return signStruct("AppOrderOperation",        struct, domain, pk ); },
	signDatasetOrderOperation:    function(domain, struct, pk) { return signStruct("DatasetOrderOperation",    struct, domain, pk ); },
	signWorkerpoolOrderOperation: function(domain, struct, pk) { return signStruct("WorkerpoolOrderOperation", struct, domain, pk ); },
	signRequestOrderOperation:    function(domain, struct, pk) { return signStruct("RequestOrderOperation",    struct, domain, pk ); },
};
