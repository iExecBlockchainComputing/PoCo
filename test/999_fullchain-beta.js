var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Beacon       = artifacts.require("./Beacon.sol");
var Broker       = artifacts.require("./Broker.sol");

const constants = require("./constants");
const obdtools  = require('../utils/odb-tools-beta');

// const BN              = require("bn");
// const keccak256       = require("solidity-sha3");
// const fs              = require("fs-extra");
// const web3utils       = require('web3-utils');
// const readFileAsync   = Promise.promisify(fs.readFile);
// const Promise         = require("bluebird");
// const addEvmFunctions = require("../utils/evmFunctions.js");
// const Extensions      = require("../utils/extensions.js");

// addEvmFunctions(web3);
// Promise.promisifyAll(web3.eth,     { suffix: "Promise" });
// Promise.promisifyAll(web3.version, { suffix: "Promise" });
// Promise.promisifyAll(web3.evm,     { suffix: "Promise" });
// Extensions.init(web3, assert);

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let poolWorker4   = accounts[7];
	let user          = accounts[8];
	let sgxEnclave    = accounts[9];

	var RLCInstance          = null;
	var IexecHubInstance     = null;
	var IexecClerkInstance   = null;
	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;
	var BeaconInstance       = null;
	var BrokerInstance       = null;

	var DappInstance = null;
	var DataInstance = null;
	var PoolInstance = null;

	var dapporder      = null;
	var dataorder      = null;
	var poolorder      = null;
	var userorder      = null;
	var woid           = null;
	var authorizations = {};
	var results        = {};

	var workers =
	[
		{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec the wanderer" },
		{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec the wanderer" },
	];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance          = await RLC.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		BeaconInstance       = await Beacon.deployed();
		BrokerInstance       = await Broker.deployed();

		/**
		 * Token distribution
		 */
		assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");
		txsMined = await Promise.all([
			RLCInstance.transfer(dappProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(dataProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolScheduler, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker1,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker2,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker3,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker4,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,          1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(dappProvider),
			RLCInstance.balanceOf(dataProvider),
			RLCInstance.balanceOf(poolScheduler),
			RLCInstance.balanceOf(poolWorker1),
			RLCInstance.balanceOf(poolWorker2),
			RLCInstance.balanceOf(poolWorker3),
			RLCInstance.balanceOf(poolWorker4),
			RLCInstance.balanceOf(user)
		]);
		assert.equal(balances[0], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[1], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[2], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[3], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[4], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[5], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[6], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[7], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider  }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider  }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1   }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2   }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3   }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker4   }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user          })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		assert.equal(events[0].args.dappOwner,  dappProvider,                  "Erroneous Dapp owner" );
		assert.equal(events[0].args.dappName,   "R Clifford Attractors",       "Erroneous Dapp name"  );
		assert.equal(events[0].args.dappParams, constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");

		DappInstance = await Dapp.at(events[0].args.dapp);
		assert.equal(await DappInstance.m_owner(),                                    dappProvider,                  "Erroneous Dapp owner" );
		assert.equal(await DappInstance.m_dappName(),                                 "R Clifford Attractors",       "Erroneous Dapp name"  );
		assert.equal(await DappInstance.m_dappParams(),                               constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");
		assert.equal((await DappRegistryInstance.viewCount(dappProvider)).toNumber(), 1,                             "dappProvider must have 1 dapp now");
		assert.equal(await DappRegistryInstance.viewEntry(dappProvider, 1),           DappInstance.address,          "check dappAddress");
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		assert.equal(events[0].args.dataOwner,  dataProvider,   "Erroneous Data owner" );
		assert.equal(events[0].args.dataName,   "Pi",           "Erroneous Data name"  );
		assert.equal(events[0].args.dataParams, "3.1415926535", "Erroneous Data params");

		DataInstance = await Data.at(events[0].args.data);
		assert.equal(await DataInstance.m_owner(),                                    dataProvider,         "Erroneous Data owner" );
		assert.equal(await DataInstance.m_dataName(),                                 "Pi",                 "Erroneous Data name"  );
		assert.equal(await DataInstance.m_dataParams(),                               "3.1415926535",       "Erroneous Data params");
		assert.equal((await DataRegistryInstance.viewCount(dataProvider)).toNumber(), 1,                    "dataProvider must have 1 dapp now");
		assert.equal(await DataRegistryInstance.viewEntry(dataProvider, 1),           DataInstance.address, "check dataAddress");
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("Pool Creation", async () => {
		txMined = await PoolRegistryInstance.createPool(
			poolScheduler,
			"A test workerpool",
			10, // lock
			10, // minimum stake
			10, // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		assert.equal(events[0].args.poolOwner,       poolScheduler,       "Erroneous Pool owner"      );
		assert.equal(events[0].args.poolDescription, "A test workerpool", "Erroneous Pool description");

		PoolInstance = await Pool.at(events[0].args.pool);
		assert.equal( await PoolInstance.m_owner(),                           poolScheduler,        "Erroneous Pool owner"              );
		assert.equal( await PoolInstance.m_poolDescription(),                 "A test workerpool",  "Erroneous Pool description"        );
		assert.equal((await PoolInstance.m_workerStakeRatioPolicy()),         30,                   "Erroneous Pool params"             );
		assert.equal((await PoolInstance.m_schedulerRewardRatioPolicy()),     1,                    "Erroneous Pool params"             );
		assert.equal((await PoolInstance.m_subscriptionLockStakePolicy()),    10,                   "Erroneous Pool params"             );
		assert.equal((await PoolInstance.m_subscriptionMinimumStakePolicy()), 10,                   "Erroneous Pool params"             );
		assert.equal((await PoolInstance.m_subscriptionMinimumScorePolicy()), 10,                   "Erroneous Pool params"             );
		assert.equal((await PoolRegistryInstance.viewCount(poolScheduler)),   1,                    "poolScheduler must have 1 pool now");
		assert.equal( await PoolRegistryInstance.viewEntry(poolScheduler, 1), PoolInstance.address, "check poolAddress"                 );
	});

	/***************************************************************************
	 *               TEST: Pool configuration (by poolScheduler)               *
	 ***************************************************************************/
	it("Pool Configuration", async () => {
		txMined = await PoolInstance.changePoolPolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(PoolInstance.PoolPolicyUpdate({}));
		events = extractEvents(txMined, PoolInstance.address, "PoolPolicyUpdate");
		assert.equal(events[0].args.oldWorkerStakeRatioPolicy,         30,  "Erroneous oldWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.newWorkerStakeRatioPolicy,         35,  "Erroneous newWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.oldSchedulerRewardRatioPolicy,     1,   "Erroneous oldSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.newSchedulerRewardRatioPolicy,     5,   "Erroneous newSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.oldSubscriptionMinimumStakePolicy, 10,  "Erroneous oldSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumStakePolicy, 100, "Erroneous newSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.oldSubscriptionMinimumScorePolicy, 10,  "Erroneous oldSubscriptionMinimumScorePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumScorePolicy, 0,   "Erroneous newSubscriptionMinimumScorePolicy");

		assert.equal( await PoolInstance.m_owner(),                           poolScheduler,        "Erroneous Pool owner"      );
		assert.equal( await PoolInstance.m_poolDescription(),                 "A test workerpool",  "Erroneous Pool description");
		assert.equal((await PoolInstance.m_workerStakeRatioPolicy()),         35,                   "Erroneous Pool params"     );
		assert.equal((await PoolInstance.m_schedulerRewardRatioPolicy()),     5,                    "Erroneous Pool params"     );
		assert.equal((await PoolInstance.m_subscriptionLockStakePolicy()),    10,                   "Erroneous Pool params"     );
		assert.equal((await PoolInstance.m_subscriptionMinimumStakePolicy()), 100,                  "Erroneous Pool params"     );
		assert.equal((await PoolInstance.m_subscriptionMinimumScorePolicy()), 0,                    "Erroneous Pool params"     );
	});

	/***************************************************************************
	 *              TEST: Dapp order signature (by dappProvider)               *
	 ***************************************************************************/
	it("Generate dapp order", async () => {
		dapporder = await obdtools.signObject(
			{
				//market
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				// restrict
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				// extra
				salt:         web3.utils.randomHex(32),
			},
			dappProvider,
			(obj) => obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(obj), obj.salt)
		);

		hash = await IexecClerkInstance.getDappOrderHash(dapporder);
		console.log(hash);

		// result = await IexecClerkInstance.isValidSignature(
		// 	dappProvider,
		// 	obdtools.getFullHash(
		// 		IexecClerkInstance.address,
		// 		obdtools.dappPartialHash(DappOrder),
		// 		DappOrder.salt
		// 	),
		// 	DappOrder.sign,
		// 	{}
		// );
		// console.log(result);

		// 	return IexecClerkInstance.getDappOrderHash(signedorder);
		// })
		// .then(function(hash) {
		// 	console.log("hash", hash);
		// });

		// assert.equal(
		// 	await IexecClerkInstance.getDappOrderHash(DappOrder),
		// 	obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(DappOrder), DappOrder.salt),
		// 	"Error with DappOrder hash computation"
		// );
		//
		// assert.equal(
		// 	await IexecClerkInstance.isValidSignature(
		// 		dappProvider,
		// 		obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(DappOrder), DappOrder.salt),
		// 		DappOrder.sign
		// 	),
		// 	true,
		// 	"Error with the validation of the DappOrder signature"
		// );

	});

	it("FINISHED", async () => {});

});
