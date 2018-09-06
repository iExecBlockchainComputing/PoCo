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

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("./constants");
const OxTools   = require('../utils/OxTools');

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

	assert.isAtLeast(accounts.length, 9, "should have at least 9 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let user          = accounts[7];
	let sgxEnclave    = accounts[8];

	var RLCInstance          = null;
	var IexecHubInstance     = null;
	var IexecClerkInstance   = null;
	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;
	var BeaconInstance       = null;
	var BrokerInstance       = null;
	var DappInstance         = null;
	var DataInstance         = null;
	var PoolInstance         = null;
	var DappOrder            = null;
	var DataOrder            = null;
	var PoolOrder            = null;
	var UserOrder            = null;

	var woid                 = null;
	var authorization        = null;
	var signedResult         = null;

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var BeaconInstanceEthers     = null;
	var BrokerInstanceEthers     = null;

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
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
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,           jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerkInstance.abi, jsonRpcProvider);
		BeaconInstanceEthers     = new ethers.Contract(BeaconInstance.address,     BeaconInstance.abi,     jsonRpcProvider);
		BrokerInstanceEthers     = new ethers.Contract(BrokerInstance.address,     BrokerInstance.abi,     jsonRpcProvider);

		/**
		 * Token distribution
		 */
		assert.strictEqual(iexecAdmin, await RLCInstance.owner.call(), "iexecAdmin should own the RLC smart contract");
		txsMined = await Promise.all([
			RLCInstance.transfer(dappProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(dataProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolScheduler, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker1,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker2,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker3,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,          1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(dappProvider),
			RLCInstance.balanceOf(dataProvider),
			RLCInstance.balanceOf(poolScheduler),
			RLCInstance.balanceOf(poolWorker1),
			RLCInstance.balanceOf(poolWorker2),
			RLCInstance.balanceOf(poolWorker3),
			RLCInstance.balanceOf(user)
		]);
		assert.strictEqual(balances[0].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[1].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[2].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[3].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[4].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[5].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.strictEqual(balances[6].toNumber(), 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(DappRegistryInstance.CreateDapp({}));
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		assert.strictEqual(events[0].args.dappOwner,  dappProvider,                  "Erroneous Dapp owner" );
		assert.strictEqual(events[0].args.dappName,   "R Clifford Attractors",       "Erroneous Dapp name"  );
		assert.strictEqual(events[0].args.dappParams, constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");

		DappInstance = await Dapp.at(events[0].args.dapp);
		assert.strictEqual(await DappInstance.m_owner.call(),                               dappProvider,                  "Erroneous Dapp owner" );
		assert.strictEqual(await DappInstance.m_dappName.call(),                            "R Clifford Attractors",       "Erroneous Dapp name"  );
		assert.strictEqual(await DappInstance.m_dappParams.call(),                          constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");
		assert.strictEqual((await DappRegistryInstance.viewCount(dappProvider)).toNumber(), 1,                             "dappProvider must have 1 dapp now");
		assert.strictEqual(await DappRegistryInstance.viewEntry(dappProvider, 1),           DappInstance.address,          "check dappAddress");
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(DataRegistryInstance.CreateData({}));
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		assert.strictEqual(events[0].args.dataOwner,  dataProvider,   "Erroneous Data owner" );
		assert.strictEqual(events[0].args.dataName,   "Pi",           "Erroneous Data name"  );
		assert.strictEqual(events[0].args.dataParams, "3.1415926535", "Erroneous Data params");

		DataInstance = await Data.at(events[0].args.data);
		assert.strictEqual(await DataInstance.m_owner.call(),                               dataProvider,         "Erroneous Data owner" );
		assert.strictEqual(await DataInstance.m_dataName.call(),                            "Pi",                 "Erroneous Data name"  );
		assert.strictEqual(await DataInstance.m_dataParams.call(),                          "3.1415926535",       "Erroneous Data params");
		assert.strictEqual((await DataRegistryInstance.viewCount(dataProvider)).toNumber(), 1,                    "dataProvider must have 1 dapp now");
		assert.strictEqual(await DataRegistryInstance.viewEntry(dataProvider, 1),           DataInstance.address, "check dataAddress");
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

		// events = await Extensions.getEventsPromise(PoolRegistryInstance.CreatePool({}));
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		assert.strictEqual(events[0].args.poolOwner,       poolScheduler,       "Erroneous Pool owner"      );
		assert.strictEqual(events[0].args.poolDescription, "A test workerpool", "Erroneous Pool description");

		PoolInstance = await Pool.at(events[0].args.pool);
		assert.strictEqual( await PoolInstance.m_owner.call(),                                      poolScheduler,        "Erroneous Pool owner"              );
		assert.strictEqual( await PoolInstance.m_poolDescription.call(),                            "A test workerpool",  "Erroneous Pool description"        );
		assert.strictEqual((await PoolInstance.m_workerStakeRatioPolicy.call()).toNumber(),         30,                   "Erroneous Pool params"             );
		assert.strictEqual((await PoolInstance.m_schedulerRewardRatioPolicy.call()).toNumber(),     1,                    "Erroneous Pool params"             );
		assert.strictEqual((await PoolInstance.m_subscriptionLockStakePolicy.call()).toNumber(),    10,                   "Erroneous Pool params"             );
		assert.strictEqual((await PoolInstance.m_subscriptionMinimumStakePolicy.call()).toNumber(), 10,                   "Erroneous Pool params"             );
		assert.strictEqual((await PoolInstance.m_subscriptionMinimumScorePolicy.call()).toNumber(), 10,                   "Erroneous Pool params"             );
		assert.strictEqual((await PoolRegistryInstance.viewCount(poolScheduler)).toNumber(),        1,                    "poolScheduler must have 1 pool now");
		assert.strictEqual( await PoolRegistryInstance.viewEntry(poolScheduler, 1),                 PoolInstance.address, "check poolAddress"                 );
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
		assert.strictEqual(events[0].args.oldWorkerStakeRatioPolicy.toNumber(),         30,  "Erroneous oldWorkerStakeRatioPolicy"        );
		assert.strictEqual(events[0].args.newWorkerStakeRatioPolicy.toNumber(),         35,  "Erroneous newWorkerStakeRatioPolicy"        );
		assert.strictEqual(events[0].args.oldSchedulerRewardRatioPolicy.toNumber(),     1,   "Erroneous oldSchedulerRewardRatioPolicy"    );
		assert.strictEqual(events[0].args.newSchedulerRewardRatioPolicy.toNumber(),     5,   "Erroneous newSchedulerRewardRatioPolicy"    );
		assert.strictEqual(events[0].args.oldSubscriptionMinimumStakePolicy.toNumber(), 10,  "Erroneous oldSubscriptionMinimumStakePolicy");
		assert.strictEqual(events[0].args.newSubscriptionMinimumStakePolicy.toNumber(), 100, "Erroneous newSubscriptionMinimumStakePolicy");
		assert.strictEqual(events[0].args.oldSubscriptionMinimumScorePolicy.toNumber(), 10,  "Erroneous oldSubscriptionMinimumScorePolicy");
		assert.strictEqual(events[0].args.newSubscriptionMinimumScorePolicy.toNumber(), 0,   "Erroneous newSubscriptionMinimumScorePolicy");

		assert.strictEqual( await PoolInstance.m_owner.call(),                                      poolScheduler,        "Erroneous Pool owner"      );
		assert.strictEqual( await PoolInstance.m_poolDescription.call(),                            "A test workerpool",  "Erroneous Pool description");
		assert.strictEqual((await PoolInstance.m_workerStakeRatioPolicy.call()).toNumber(),         35,                   "Erroneous Pool params"     );
		assert.strictEqual((await PoolInstance.m_schedulerRewardRatioPolicy.call()).toNumber(),     5,                    "Erroneous Pool params"     );
		assert.strictEqual((await PoolInstance.m_subscriptionLockStakePolicy.call()).toNumber(),    10,                   "Erroneous Pool params"     );
		assert.strictEqual((await PoolInstance.m_subscriptionMinimumStakePolicy.call()).toNumber(), 100,                  "Erroneous Pool params"     );
		assert.strictEqual((await PoolInstance.m_subscriptionMinimumScorePolicy.call()).toNumber(), 0,                    "Erroneous Pool params"     );
	});

	/***************************************************************************
	 *              TEST: Dapp order signature (by dappProvider)               *
	 ***************************************************************************/
	it("Generate dapp order", async () => {
		DappOrder = OxTools.signObject(
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
				salt:         ethers.utils.randomBytes(32),
			},
			dappProvider,
			(obj) => OxTools.getFullHash(IexecClerkInstance.address, OxTools.dappPartialHash(obj), obj.salt)
		);

		IexecClerkInstanceEthers.getDappOrderHash(
			DappOrder
		).then(function (hash) {
			assert.strictEqual(
				hash,
				OxTools.getFullHash(
					IexecClerkInstance.address,
					OxTools.dappPartialHash(DappOrder),
					DappOrder.salt
				),
				"Error with DappOrder hash computation"
			);
		});

		IexecClerkInstanceEthers.isValidSignature(
			dappProvider,
			OxTools.getFullHash(
				IexecClerkInstance.address,
				OxTools.dappPartialHash(DappOrder),
				DappOrder.salt
			),
			DappOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the DappOrder signature");
		});

	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("Generate data order", async () => {
		DataOrder = OxTools.signObject(
			{
				//market
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				// restrict
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			dataProvider,
			(obj) => OxTools.getFullHash(IexecClerkInstance.address, OxTools.dataPartialHash(obj), obj.salt)
		);

		IexecClerkInstanceEthers.getDataOrderHash(
			DataOrder
		).then(function (hash) {
			assert.strictEqual(
				hash,
				OxTools.getFullHash(
					IexecClerkInstance.address,
					OxTools.dataPartialHash(DataOrder),
					DataOrder.salt
				),
				"Error with DataOrder hash computation"
			);
		});

		IexecClerkInstanceEthers.isValidSignature(
			dataProvider,
			OxTools.getFullHash(
				IexecClerkInstance.address,
				OxTools.dataPartialHash(DataOrder),
				DataOrder.salt
			),
			DataOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the DataOrder signature");
		});

	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("Generate pool order", async () => {
		PoolOrder = OxTools.signObject(
			{
				// market
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       3,
				// settings
				category:     4,
				trust:        1000,
				tag:          0,
				// restrict
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			poolScheduler,
			(obj) => OxTools.getFullHash(IexecClerkInstance.address, OxTools.poolPartialHash(obj), obj.salt)
		);

		IexecClerkInstanceEthers.getPoolOrderHash(
			PoolOrder
		).then(function (hash) {
			assert.strictEqual(
				hash,
				OxTools.getFullHash(
					IexecClerkInstance.address,
					OxTools.poolPartialHash(PoolOrder),
					PoolOrder.salt
				),
				"Error with PoolOrder hash computation"
			);
		});

		IexecClerkInstanceEthers.isValidSignature(
			poolScheduler,
			OxTools.getFullHash(
				IexecClerkInstance.address,
				OxTools.poolPartialHash(PoolOrder),
				PoolOrder.salt
			),
			PoolOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the PoolOrder signature");
		});

	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("Generate user order", async () => {
		UserOrder = OxTools.signObject(
			{
				// market
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				// pool:         PoolInstance.address,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				// settings
				category:     4,
				trust:        1000,
				tag:          0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "echo HelloWorld",
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			user,
			(obj) => OxTools.getFullHash(IexecClerkInstance.address, OxTools.userPartialHash(obj), obj.salt)
		);

		IexecClerkInstanceEthers.getUserOrderHash(
			UserOrder
		).then(function (hash) {
			assert.strictEqual(
				hash,
				OxTools.getFullHash(
					IexecClerkInstance.address,
					OxTools.userPartialHash(UserOrder),
					UserOrder.salt
				),
				"Error with UserOrder hash computation"
			);
		});

		IexecClerkInstanceEthers.isValidSignature(
			user,
			OxTools.getFullHash(
				IexecClerkInstance.address,
				OxTools.userPartialHash(UserOrder),
				UserOrder.salt
			),
			UserOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the UserOrder signature");
		});
	});


	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("Check balances - Initial", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: poolScheduler }),
			IexecClerkInstance.deposit(1000, { from: poolWorker1   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker2   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker3   }),
			IexecClerkInstance.deposit(1000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// UNSAFE TEST: Promise all doest not handle events correctly
		/*
		events = extractEvents(txsMined[0], IexecClerkInstance.address, "Deposit");
		assert.strictEqual(events[0].args.owner,             poolScheduler, "check deposit recipient");
		assert.strictEqual(events[0].args.amount.toNumber(), 1000,          "check deposit amount");
		events = extractEvents(txsMined[1], IexecClerkInstance.address, "Deposit");
		assert.strictEqual(events[0].args.owner,             poolWorker1,   "check deposit recipient");
		assert.strictEqual(events[0].args.amount.toNumber(), 1000,          "check deposit amount");
		events = extractEvents(txsMined[2], IexecClerkInstance.address, "Deposit");
		assert.strictEqual(events[0].args.owner,             poolWorker2,   "check deposit recipient");
		assert.strictEqual(events[0].args.amount.toNumber(), 1000,          "check deposit amount");
		events = extractEvents(txsMined[3], IexecClerkInstance.address, "Deposit");
		assert.strictEqual(events[0].args.owner,             poolWorker3,   "check deposit recipient");
		assert.strictEqual(events[0].args.amount.toNumber(), 1000,          "check deposit amount");
		events = extractEvents(txsMined[4], IexecClerkInstance.address, "Deposit");
		assert.strictEqual(events[0].args.owner,             user,          "check deposit recipient");
		assert.strictEqual(events[0].args.amount.toNumber(), 1000,          "check deposit amount");
		*/

		balance = await IexecClerkInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                       TEST: Worker join the pool                        *
	 ***************************************************************************/
	it("Worker join", async () => {
		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker1), constants.NULL.ADDRESS, "affectation issue");
		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker2), constants.NULL.ADDRESS, "affectation issue");
		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker3), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker1 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.strictEqual(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.strictEqual(events[0].args.worker, poolWorker1,          "check worker");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker2 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.strictEqual(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.strictEqual(events[0].args.worker, poolWorker2,          "check worker");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker3 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.strictEqual(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.strictEqual(events[0].args.worker, poolWorker3,          "check worker");

		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker1), PoolInstance.address, "affectation issue");
		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker2), PoolInstance.address, "affectation issue");
		assert.strictEqual(await IexecHubInstance.viewAffectation.call(poolWorker3), PoolInstance.address, "affectation issue");

		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),  10, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),  10, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),  10, "check balance stake locked");
	});

	/***************************************************************************
	 *                       TEST: Worker leave the pool                       *
	 ***************************************************************************/
	it("Worker unsubscription & eviction", async () => {
		txsMined = await Promise.all([
			IexecHubInstance.unsubscribe(             { from: poolWorker2   }),
			IexecHubInstance.evict      (poolWorker3, { from: poolScheduler }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txsMined[0], IexecHubInstance.address, "WorkerUnsubscription");
		assert.strictEqual(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.strictEqual(events[0].args.worker, poolWorker2,          "check worker");
		events = extractEvents(txsMined[1], IexecHubInstance.address, "WorkerEviction");
		assert.strictEqual(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.strictEqual(events[0].args.worker, poolWorker3,          "check worker");

		affectation = await IexecHubInstance.viewAffectation.call(poolWorker1);
		assert.strictEqual(affectation, PoolInstance.address,   "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker2);
		assert.strictEqual(affectation, constants.NULL.ADDRESS, "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker3);
		assert.strictEqual(affectation, constants.NULL.ADDRESS, "affectation issue");

		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(),  990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),   10, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("Check balances - Before", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy.call(dataProvider)
		assert.strictEqual(balance[0].toNumber(),    0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(dappProvider)
		assert.strictEqual(balance[0].toNumber(),    0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(),  990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),   10, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("Check score - Before", async () => {
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker1)).toNumber(), 0, "score issue");
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker2)).toNumber(), 0, "score issue");
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker3)).toNumber(), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it("[RUN] matchOrders", async () => {

		woid = OxTools.getFullHash(IexecClerkInstance.address, OxTools.userPartialHash(UserOrder), UserOrder.salt);

		txNotMined = await IexecClerkInstanceEthers
		.connect(jsonRpcProvider.getSigner(user))
		.matchOrders(
			DappOrder,
			DataOrder,
			PoolOrder,
			UserOrder,
			{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		// console.log("txNotMined:", txNotMined);

		// txReceipt = await txNotMined.wait(); // SLOW!!!
		// console.log("txReceipt:", txReceipt);

		// TODO: check gas, events ...

	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("Check deal", async () => {
		IexecClerkInstanceEthers.viewDeal(woid).then(function(deal) {
			assert.strictEqual(deal.dapp.pointer.toLowerCase(),      DappInstance.address,                       "check deal (deal.dapp.pointer)"        );
			assert.strictEqual(deal.dapp.owner.toLowerCase(),        dappProvider,                               "check deal (deal.dapp.owner)"          );
			assert.strictEqual(deal.dapp.price.toNumber(),           DappOrder.dappprice,                        "check deal (deal.dapp.price)"          );
			assert.strictEqual(deal.dapp.pointer.toLowerCase(),      UserOrder.dapp,                             "check deal (deal.dapp.pointer)"        );
			assert.isAtMost   (deal.dapp.price.toNumber(),           UserOrder.dappmaxprice,                     "check deal (deal.dapp.price)"          );
			assert.strictEqual(deal.data.pointer.toLowerCase(),      DataInstance.address,                       "check deal (deal.data.pointer)"        );
			assert.strictEqual(deal.data.owner.toLowerCase(),        dataProvider,                               "check deal (deal.data.owner)"          );
			assert.strictEqual(deal.data.price.toNumber(),           DataOrder.dataprice,                        "check deal (deal.data.price)"          );
			assert.strictEqual(deal.data.pointer.toLowerCase(),      UserOrder.data,                             "check deal (deal.data.pointer)"        );
			assert.isAtMost   (deal.data.price.toNumber(),           UserOrder.datamaxprice,                     "check deal (deal.data.price)"          );
			assert.strictEqual(deal.pool.pointer.toLowerCase(),      PoolInstance.address,                       "check deal (deal.pool.pointer)"        );
			assert.strictEqual(deal.pool.owner.toLowerCase(),        poolScheduler,                              "check deal (deal.pool.owner)"          );
			assert.strictEqual(deal.pool.price.toNumber(),           PoolOrder.poolprice,                        "check deal (deal.pool.price)"          );
			if( UserOrder.pool != constants.NULL.ADDRESS)
			assert.strictEqual(deal.pool.pointer.toLowerCase(),      UserOrder.pool,                             "check deal (deal.pool.pointer)"        );
			assert.isAtMost   (deal.pool.price.toNumber(),           UserOrder.poolmaxprice,                     "check deal (deal.pool.price)"          );
			assert.strictEqual(deal.category.toNumber(),             PoolOrder.category,                         "check deal (deal.category)"            );
			assert.strictEqual(deal.category.toNumber(),             UserOrder.category,                         "check deal (deal.category)"            );
			assert.strictEqual(deal.trust.toNumber(),                PoolOrder.trust,                            "check deal (deal.trust)"               );
			assert.isAtLeast  (deal.trust.toNumber(),                UserOrder.trust,                            "check deal (deal.trust)"               );
			assert.strictEqual(deal.tag.toNumber(),                  PoolOrder.tag,                              "check deal (deal.tag)"                 );
			assert.strictEqual(deal.tag.toNumber(),                  UserOrder.tag,                              "check deal (deal.tag)"                 );
			assert.strictEqual(deal.requester.toLowerCase(),         user,                                       "check deal (deal.requester)"           );
			assert.strictEqual(deal.beneficiary.toLowerCase(),       user,                                       "check deal (deal.beneficiary)"         );
			assert.strictEqual(deal.callback.toLowerCase(),          UserOrder.callback,                         "check deal (deal.callback)"            );
			assert.strictEqual(deal.params,                          UserOrder.params,                           "check deal (deal.params)"              );
			assert.strictEqual(deal.workerStake.toNumber(),          Math.floor(deal.pool.price.toNumber()*.35), "check deal (deal.workerStake)"         );
			assert.strictEqual(deal.schedulerRewardRatio.toNumber(), 5,                                          "check deal (deal.schedulerRewardRatio)");
		});
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("Check workorder", async () => {
		IexecHubInstanceEthers.viewWorkorder(woid).then(function(workorder) {
			assert.strictEqual    (workorder.status,                       constants.WorkOrderStatusEnum.ACTIVE, "check workorder (workorder.status)"           );
			assert.strictEqual    (workorder.consensusValue,               constants.NULL.BYTES32,               "check workorder (workorder.consensusValue)"   );
		//assert.strictEqual    (workorder.consensusDeadline.toNumber(), "",                                   "check workorder (workorder.consensusDeadline)");
		//assert.strictEqual    (workorder.revealDeadline.toNumber(),    "",                                   "check workorder (workorder.revealDeadline)"   );
			assert.strictEqual    (workorder.revealCounter.toNumber(),     0,                                    "check workorder (workorder.revealCounter)"    );
			assert.strictEqual    (workorder.winnerCounter.toNumber(),     0,                                    "check workorder (workorder.winnerCounter)"    );
			assert.deepStrictEqual(workorder.contributors,                 [],                                   "check workorder (workorder.contributors)"     );
		});
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("Check balances - Locked #1", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy.call(dappProvider)
		assert.strictEqual(balance[0].toNumber(),                      0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),                      0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(dataProvider)
		assert.strictEqual(balance[0].toNumber(),                      0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),                      0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 1000-Math.floor(25*0.3), "check balance stake locked"); // POOL_STAKE_RATIO is 35 (SC constant)
		assert.strictEqual(balance[1].toNumber(),      Math.floor(25*0.3), "check balance stake locked"); // POOL_STAKE_RATIO is 35 (SC constant)
		balance = await IexecClerkInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 1000-          (25+3+1), "check balance stake locked"); // Dapp + Data + Pool prices
		assert.strictEqual(balance[1].toNumber(),                (25+3+1), "check balance stake locked"); // Dapp + Data + Pool prices
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it("Sign contribution authorization", async () => {
		authorization = OxTools.signObject(
			{
				worker:  poolWorker1,
				woid:    woid,
				enclave: sgxEnclave // constants.NULL.ADDRESS
			},
			poolScheduler,
			(obj) => OxTools.authorizeHash(obj)
		);
	});

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it("Run job", async () => {
		processedResult = OxTools.signResult("iExec the wanderer", poolWorker1);

		if (sgxEnclave != constants.NULL.ADDRESS)
		{
			// With SGX
			OxTools.signObject(
				processedResult,
				sgxEnclave,
				(obj) => obj.contribution.hash.substr(2,64) + obj.contribution.sign.substr(2,64)
			);
		}
		else
		{
			// Without SGX
			processedResult.sign = constants.NULL.SIGNATURE;
		}
	});

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it("[RUN] signedContribute", async () => {
		txNotMined = await IexecHubInstanceEthers
		.connect(jsonRpcProvider.getSigner(poolWorker1))
		.signedContribute(
			woid,                              // worker    (authorization)
			processedResult.contribution.hash, // common    (result)
			processedResult.contribution.sign, // unique    (result)
			sgxEnclave,                        // address   (enclave)
			processedResult.sign,              // signature (enclave)
			authorization.sign,                // signature (authorization)
			{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		// console.log("txNotMined:", txNotMined);

		// txReceipt = await txNotMined.wait(); // SLOW!!!
		// console.log("txReceipt:", txReceipt);

		// TODO: check gas, events ...


	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("Check contribution", async () => {
		IexecHubInstanceEthers.viewContribution(woid, poolWorker1).then(function(contribution) {
			assert.strictEqual(contribution.status,                         constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.strictEqual(contribution.resultHash,                     processedResult.contribution.hash,            "check contribution (contribution.resultHash)"      );
			assert.strictEqual(contribution.resultSign,                     processedResult.contribution.sign,            "check contribution (contribution.resultSign)"      );
			assert.strictEqual(contribution.enclaveChallenge.toLowerCase(), sgxEnclave,                                   "check contribution (contribution.enclaveChallenge)");
			assert.strictEqual(contribution.score.toNumber(),               0,                                            "check contribution (contribution.score)"           );
			assert.strictEqual(contribution.weight.toNumber(),              1,                                            "check contribution (contribution.weight)"          );
		});
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("Check balances - Locked #2", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(),  990-Math.floor(25*0.35), "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),   10+Math.floor(25*0.35), "check balance stake locked");
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("Check workorder", async () => {
		IexecHubInstanceEthers.viewWorkorder(woid).then(function(workorder) {
			assert.strictEqual    (workorder.status,                                     constants.WorkOrderStatusEnum.ACTIVE, "check workorder (workorder.status)"           );
			assert.strictEqual    (workorder.consensusValue,                             constants.NULL.BYTES32,               "check workorder (workorder.consensusValue)"   );
		//assert.strictEqual    (workorder.consensusDeadline.toNumber(),               "",                                   "check workorder (workorder.consensusDeadline)");
		//assert.strictEqual    (workorder.revealDeadline.toNumber(),                  "",                                   "check workorder (workorder.revealDeadline)"   );
			assert.strictEqual    (workorder.revealCounter.toNumber(),                   0,                                    "check workorder (workorder.revealCounter)"    );
			assert.strictEqual    (workorder.winnerCounter.toNumber(),                   0,                                    "check workorder (workorder.winnerCounter)"    );
			assert.deepStrictEqual(workorder.contributors.map(adr => adr.toLowerCase()), [poolWorker1],                        "check workorder (workorder.contributors)"     );
		});
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it("[RUN] revealConsensus", async () => {
		txMined = await IexecHubInstance.revealConsensus(
			woid,
			OxTools.hashResult("iExec the wanderer").contribution.hash,
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusRevealConsensus");
		assert.strictEqual(events[0].args.woid,      woid,                                                       "check woid"     );
		assert.strictEqual(events[0].args.consensus, OxTools.hashResult("iExec the wanderer").contribution.hash, "check consensus");
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("Check workorder", async () => {
		IexecHubInstanceEthers.viewWorkorder(woid).then(function(workorder) {
			assert.strictEqual    (workorder.status,                                     constants.WorkOrderStatusEnum.REVEALING,                    "check workorder (workorder.status)"           );
			assert.strictEqual    (workorder.consensusValue,                             OxTools.hashResult("iExec the wanderer").contribution.hash, "check workorder (workorder.consensusValue)"   );
		//assert.strictEqual    (workorder.consensusDeadline.toNumber(),               "",                                                         "check workorder (workorder.consensusDeadline)");
		//assert.strictEqual    (workorder.revealDeadline.toNumber(),                  "",                                                         "check workorder (workorder.revealDeadline)"   );
			assert.strictEqual    (workorder.revealCounter.toNumber(),                   0,                                                          "check workorder (workorder.revealCounter)"    );
			assert.strictEqual    (workorder.winnerCounter.toNumber(),                   1,                                                          "check workorder (workorder.winnerCounter)"    );
			assert.deepStrictEqual(workorder.contributors.map(adr => adr.toLowerCase()), [poolWorker1],                                              "check workorder (workorder.contributors)"     );
		});
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it("[RUN] reveal", async () => {
		txMined = await IexecHubInstance.reveal(
			woid,
			processedResult.base,
			{ from: poolWorker1 }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusReveal");
		assert.strictEqual(events[0].args.woid,   woid,                 "check woid"  );
		assert.strictEqual(events[0].args.worker, poolWorker1,          "check worker");
		assert.strictEqual(events[0].args.result, processedResult.base, "check result");
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("Check workorder", async () => {
		IexecHubInstanceEthers.viewWorkorder(woid).then(function(workorder) {
			assert.strictEqual    (workorder.status,                                     constants.WorkOrderStatusEnum.REVEALING,                    "check workorder (workorder.status)"           );
			assert.strictEqual    (workorder.consensusValue,                             OxTools.hashResult("iExec the wanderer").contribution.hash, "check workorder (workorder.consensusValue)"   );
		//assert.strictEqual    (workorder.consensusDeadline.toNumber(),               "",                                                         "check workorder (workorder.consensusDeadline)");
		//assert.strictEqual    (workorder.revealDeadline.toNumber(),                  "",                                                         "check workorder (workorder.revealDeadline)"   );
			assert.strictEqual    (workorder.revealCounter.toNumber(),                   1,                                                          "check workorder (workorder.revealCounter)"    );
			assert.strictEqual    (workorder.winnerCounter.toNumber(),                   1,                                                          "check workorder (workorder.winnerCounter)"    );
			assert.deepStrictEqual(workorder.contributors.map(adr => adr.toLowerCase()), [poolWorker1],                                              "check workorder (workorder.contributors)"     );
		});
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it("[RUN] finalizeWork", async () => {
		txMined = await IexecHubInstance.finalizeWork(
			woid,
			"aStdout",
			"aStderr",
			"anUri",
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusFinalized");
		assert.strictEqual(events[0].args.woid,   woid,      "check consensus (  woid)");
		assert.strictEqual(events[0].args.stdout, "aStdout", "check consensus (stdout)");
		assert.strictEqual(events[0].args.stderr, "aStderr", "check consensus (stderr)");
		assert.strictEqual(events[0].args.uri,    "anUri",   "check consensus (   uri)");
		events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		assert.strictEqual(events[0].args.woid,                 woid,        "check AccurateContribution (  woid)");
		assert.strictEqual(events[0].args.worker.toLowerCase(), poolWorker1, "check AccurateContribution (worker)");
		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("Check workorder", async () => {
		IexecHubInstanceEthers.viewWorkorder(woid).then(function(workorder) {
			assert.strictEqual    (workorder.status,                                     constants.WorkOrderStatusEnum.COMPLETED,                    "check workorder (workorder.status)"           );
			assert.strictEqual    (workorder.consensusValue,                             OxTools.hashResult("iExec the wanderer").contribution.hash, "check workorder (workorder.consensusValue)"   );
		//assert.strictEqual    (workorder.consensusDeadline.toNumber(),               "",                                                         "check workorder (workorder.consensusDeadline)");
		//assert.strictEqual    (workorder.revealDeadline.toNumber(),                  "",                                                         "check workorder (workorder.revealDeadline)"   );
			assert.strictEqual    (workorder.revealCounter.toNumber(),                   1,                                                          "check workorder (workorder.revealCounter)"    );
			assert.strictEqual    (workorder.winnerCounter.toNumber(),                   1,                                                          "check workorder (workorder.winnerCounter)"    );
			assert.deepStrictEqual(workorder.contributors.map(adr => adr.toLowerCase()), [poolWorker1],                                              "check workorder (workorder.contributors)"     );
		});
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("check balances - After", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy.call(dataProvider);
		assert.strictEqual(balance[0].toNumber(),    1, "check balance stake locked"); // 0 + 1
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(dappProvider);
		assert.strictEqual(balance[0].toNumber(),    3, "check balance stake locked"); // 0 + 3
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolScheduler);
		assert.strictEqual(balance[0].toNumber(), 1002, "check balance stake locked"); // 1000 + 2
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker1);
		assert.strictEqual(balance[0].toNumber(), 1013, "check balance stake locked"); // 990 + 23
		assert.strictEqual(balance[1].toNumber(),   10, "check balance stake locked"); // lock for workerpool
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker2);
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(poolWorker3);
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await IexecClerkInstance.viewAccountLegacy.call(user);
		assert.strictEqual(balance[0].toNumber(),  971, "check balance stake locked"); // 1000 - 25 - 3 - 1
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("check score - After", async () => {
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker1)).toNumber(), 1, "score issue");
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker2)).toNumber(), 0, "score issue");
		assert.strictEqual((await IexecHubInstance.viewScore.call(poolWorker3)).toNumber(), 0, "score issue");
	});

	it("FINISHED", async () => {});

});
