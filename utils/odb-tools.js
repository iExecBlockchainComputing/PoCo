/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

const sigUtil   = require('eth-sig-util');
const constants = require('./constants');



const TYPES =
{
	EIP712Domain: [
		{ type: "string",  name: "name"               },
		{ type: "string",  name: "version"            },
		{ type: "uint256", name: "chainId"            },
		{ type: "address", name: "verifyingContract"  },
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

function eth_sign(hash, wallet)
{
	return new Promise((resolve, reject) => {
		if (wallet.sign)
		{
			resolve(wallet.sign(hash).signature)
		}
		else
		{
			web3.eth.sign(hash, wallet.address).then(resolve).catch(reject);
		}
	});
}

function eth_signTypedData(primaryType, message, domain, wallet)
{
	return new Promise((resolve, reject) => {
		const data = {
			types: TYPES,
			primaryType,
			domain:
			{
				name:              domain.name,
				version:           domain.version,
				chainId:           domain.chainId,
				verifyingContract: domain.verifyingContract,
			},
			message,
		};
		if (wallet.privateKey)
		{
			resolve(sigUtil.signTypedData(Buffer.from(wallet.privateKey.substring(2), 'hex'), { data }));
		}
		else
		{
			web3.currentProvider.send({
				method: "eth_signTypedData",
				params: [ wallet.address, data ],
				from: wallet.address,
			}, (err, result) => {
				if (!err)
				{
					resolve(result.result);
				}
				else
				{
					reject(err);
				}
			});
		}
	});
}

function signMessage(obj, hash, wallet)
{
	return eth_sign(hash, wallet).then(sign => {
		obj.sign = sign;
		return obj;
	});
}

function signStruct(primaryType, message, domain, wallet)
{
	return eth_signTypedData(primaryType, message, domain, wallet).then(sign => {
		message.sign = sign;
		return message;
	});
}

function hashStruct(primaryType, message, domain)
{
	return '0x' + sigUtil.TypedDataUtils.sign({
		types: TYPES,
		primaryType,
		message,
		domain,
	}).toString('hex');
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
 *                                 MOCK AGENT                                *
 *****************************************************************************/
class iExecAgent
{
	constructor(iexec, account)
	{
		this.iexec  = iexec;
		this.wallet = account
		? { address: account }
		: web3.eth.accounts.create();
		this.address = this.wallet.address;
	}
	async domain() { return await this.iexec.domain(); }
	async signMessage                 (obj, hash) { return signMessage(obj, hash, this.wallet); }
	async signAppOrder                (struct)    { return signStruct("AppOrder",                 struct, await this.domain(), this.wallet); }
	async signDatasetOrder            (struct)    { return signStruct("DatasetOrder",             struct, await this.domain(), this.wallet); }
	async signWorkerpoolOrder         (struct)    { return signStruct("WorkerpoolOrder",          struct, await this.domain(), this.wallet); }
	async signRequestOrder            (struct)    { return signStruct("RequestOrder",             struct, await this.domain(), this.wallet); }
	async signAppOrderOperation       (struct)    { return signStruct("AppOrderOperation",        struct, await this.domain(), this.wallet); }
	async signDatasetOrderOperation   (struct)    { return signStruct("DatasetOrderOperation",    struct, await this.domain(), this.wallet); }
	async signWorkerpoolOrderOperation(struct)    { return signStruct("WorkerpoolOrderOperation", struct, await this.domain(), this.wallet); }
	async signRequestOrderOperation   (struct)    { return signStruct("RequestOrderOperation",    struct, await this.domain(), this.wallet); }

	async viewAccount()
	{
		return Object.extract(await this.iexec.viewAccount(this.wallet.address), [ 'stake', 'locked' ]).map(bn => Number(bn));
	}
	async viewScore()
	{
		return Number(await this.iexec.viewScore(this.wallet.address));
	}
}
/*****************************************************************************
 *                                MOCK BROKER                                *
 *****************************************************************************/
class Broker extends iExecAgent
{
	constructor(iexec)
	{
		super(iexec);
	}

	async initialize()
	{
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
 *                               MOCK SCHEDULER                              *
 *****************************************************************************/
class Scheduler extends iExecAgent
{
	constructor(iexec, wallet)
	{
		super(iexec, wallet);
	}

	async signPreAuthorization(taskid, worker)
	{
		return await signAuthorization({ taskid, worker, enclave: constants.NULL.ADDRESS }, this.wallet);
	}
}
/*****************************************************************************
 *                                MOCK WORKER                                *
 *****************************************************************************/
class Worker extends iExecAgent
{
	constructor(iexec, wallet)
	{
		super(iexec, wallet);
	}

	async run(auth, enclaveWallet, result, callback)
	{
		const contribution = sealByteResult(
			auth.taskid,
			callback ? web3.utils.soliditySha3({t: 'bytes', v: callback }) : web3.utils.soliditySha3({t: 'string', v: result }),
			this.wallet.address
		);
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
	iExecAgent,
	Scheduler,
	Broker,
	Worker,
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
		sealResult,
		hashConsensus: hashResult,
		hashAppOrder:                 function(domain, struct) { return hashStruct("AppOrder",                 struct, domain); },
		hashDatasetOrder:             function(domain, struct) { return hashStruct("DatasetOrder",             struct, domain); },
		hashWorkerpoolOrder:          function(domain, struct) { return hashStruct("WorkerpoolOrder",          struct, domain); },
		hashRequestOrder:             function(domain, struct) { return hashStruct("RequestOrder",             struct, domain); },
		hashAppOrderOperation:        function(domain, struct) { return hashStruct("AppOrderOperation",        struct, domain); },
		hashDatasetOrderOperation:    function(domain, struct) { return hashStruct("DatasetOrderOperation",    struct, domain); },
		hashWorkerpoolOrderOperation: function(domain, struct) { return hashStruct("WorkerpoolOrderOperation", struct, domain); },
		hashRequestOrderOperation:    function(domain, struct) { return hashStruct("RequestOrderOperation",    struct, domain); },
		requestToDeal,
	},
};
