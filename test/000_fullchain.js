var RLC         = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub    = artifacts.require("./IexecHub.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var DappHub     = artifacts.require("./DappHub.sol");
var DataHub     = artifacts.require("./DataHub.sol");
var PoolHub     = artifacts.require("./PoolHub.sol");
var Dapp        = artifacts.require("./Dapp.sol");
var Data        = artifacts.require("./Data.sol");
var Pool        = artifacts.require("./Pool.sol");

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

	var RLCInstance         = null;
	var IexecHubInstance    = null;
	var MarketplaceInstance = null;
	var DappHubInstance     = null;
	var DataHubInstance     = null;
	var PoolHubInstance     = null;
	var DappInstance        = null;
	var DataInstance        = null;
	var PoolInstance        = null;
	var DappOrder           = null;
	var DataOrder           = null;
	var PoolOrder           = null;
	var UserOrder           = null;

	var MarketplaceInstanceEther = null;

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		/**
		 * Retreive deployed contracts
		 */
		RLCInstance         = await RLC.deployed();
		IexecHubInstance    = await IexecHub.deployed();
		MarketplaceInstance = await Marketplace.deployed();
		DappHubInstance     = await DappHub.deployed();
		DataHubInstance     = await DataHub.deployed();
		PoolHubInstance     = await PoolHub.deployed();

		/**
		 * For ABIEncoderV2
		 */
		let abi                  = JSON.stringify(Marketplace.abi);
		let provider             = new ethers.providers.JsonRpcProvider('http://localhost:8545');
		MarketplaceInstanceEther = new ethers.Contract(MarketplaceInstance.address, abi, provider);

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
			RLCInstance.approve(Marketplace.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(Marketplace.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
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
		txMined = await IexecHubInstance.createDapp("R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(IexecHubInstance.CreateDapp({}));
		events = extractEvents(txMined, IexecHubInstance.address, "CreateDapp");
		assert.strictEqual(events[0].args.dappOwner,  dappProvider,                  "Erroneous Dapp owner" );
		assert.strictEqual(events[0].args.dappName,   "R Clifford Attractors",       "Erroneous Dapp name"  );
		assert.strictEqual(events[0].args.dappParams, constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");

		DappInstance = await Dapp.at(events[0].args.dapp);

		let count = await DappHubInstance.viewCount(dappProvider);
		assert.strictEqual(count.toNumber(), 1, "dappProvider must have 1 dapp now");

		let dappAddress = await DappHubInstance.viewEntry(dappProvider, 1);
		assert.strictEqual(dappAddress, DappInstance.address, "check dappAddress");
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("Data Creation", async () => {
		txMined = await IexecHubInstance.createData("Pi", "3.1415926535", { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(IexecHubInstance.CreateData({}));
		events = extractEvents(txMined, IexecHubInstance.address, "CreateData");
		assert.strictEqual(events[0].args.dataOwner,  dataProvider,   "Erroneous Data owner" );
		assert.strictEqual(events[0].args.dataName,   "Pi",           "Erroneous Data name"  );
		assert.strictEqual(events[0].args.dataParams, "3.1415926535", "Erroneous Data params");

		DataInstance = await Data.at(events[0].args.data);

		let count = await DataHubInstance.viewCount(dataProvider);
		assert.strictEqual(count.toNumber(), 1, "dataProvider must have 1 data now");

		let dataAddress = await DataHubInstance.viewEntry(dataProvider, 1);
		assert.strictEqual(dataAddress, DataInstance.address, "check dataAddress");
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("Pool Creation", async () => {
		txMined = await IexecHubInstance.createPool(
			"A test workerpool",
			10, // lock
			10, // minimum stake
			10, // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// events = await Extensions.getEventsPromise(IexecHubInstance.CreatePool({}));
		events = extractEvents(txMined, IexecHubInstance.address, "CreatePool");
		assert.strictEqual(events[0].args.poolOwner,       poolScheduler,       "Erroneous Pool owner"      );
		assert.strictEqual(events[0].args.poolDescription, "A test workerpool", "Erroneous Pool description");

		PoolInstance = await Pool.at(events[0].args.pool);

		let count = await PoolHubInstance.viewCount(poolScheduler);
		assert.strictEqual(count.toNumber(), 1, "poolScheduler must have 1 pool now");

		let poolAddress = await PoolHubInstance.viewEntry(poolScheduler, 1);
		assert.strictEqual(poolAddress, PoolInstance.address, "check poolAddress");
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
	});

	/***************************************************************************
	 *                     TEST: Check marketplace escrow                      *
	 ***************************************************************************/
	it("Check escrow balances", async () => {
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 0, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(), 0, "check balance stake locked");
	});

	/***************************************************************************
	 *                   TEST: Deposit funds to marketplace                    *
	 ***************************************************************************/
	it("Marketplace deposit", async () => {
		txsMined = await Promise.all([
			MarketplaceInstance.deposit(1000, { from: poolScheduler }),
			MarketplaceInstance.deposit(1000, { from: poolWorker1   }),
			MarketplaceInstance.deposit(1000, { from: poolWorker2   }),
			MarketplaceInstance.deposit(1000, { from: poolWorker3   }),
			MarketplaceInstance.deposit(1000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		balance = await MarketplaceInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                       TEST: Worker join the pool                        *
	 ***************************************************************************/
	it("Worker join", async () => {
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker1);
		assert.strictEqual(affectation, "0x0000000000000000000000000000000000000000", "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker2);
		assert.strictEqual(affectation, "0x0000000000000000000000000000000000000000", "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker3);
		assert.strictEqual(affectation, "0x0000000000000000000000000000000000000000", "affectation issue");

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

		affectation = await IexecHubInstance.viewAffectation.call(poolWorker1);
		assert.strictEqual(affectation, PoolInstance.address, "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker2);
		assert.strictEqual(affectation, PoolInstance.address, "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker3);
		assert.strictEqual(affectation, PoolInstance.address, "affectation issue");

		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(), 990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),  10, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),  10, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker3)
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
		assert.strictEqual(affectation, PoolInstance.address,                         "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker2);
		assert.strictEqual(affectation, "0x0000000000000000000000000000000000000000", "affectation issue");
		affectation = await IexecHubInstance.viewAffectation.call(poolWorker3);
		assert.strictEqual(affectation, "0x0000000000000000000000000000000000000000", "affectation issue");

		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(),  990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),   10, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *              TEST: Dapp order signature (by dappProvider)               *
	 ***************************************************************************/
	it("Generate dapp order", async () => {
		DappOrder = OxTools.signMarket(
			{
				//market
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			dappProvider,
			(obj) => OxTools.getDappOrderHash(Marketplace.address, obj)
		);

		MarketplaceInstanceEther.getDappOrderHash(
			DappOrder
		).then(function (hash) {
			assert.strictEqual(hash, OxTools.getDappOrderHash(Marketplace.address, DappOrder), "Error with DappOrder hash computation");
		});

		MarketplaceInstanceEther.isValidSignature(
			dappProvider,
			OxTools.getDappOrderHash(Marketplace.address, DappOrder),
			DappOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the DappOrder signature");
		});

	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("Generate data order", async () => {
		DataOrder = OxTools.signMarket(
			{
				//market
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			dataProvider,
			(obj) => OxTools.getDataOrderHash(Marketplace.address, obj)
		);

		MarketplaceInstanceEther.getDataOrderHash(
			DataOrder
		).then(function (hash) {
			assert.strictEqual(hash, OxTools.getDataOrderHash(Marketplace.address, DataOrder), "Error with DataOrder hash computation");
		});

		MarketplaceInstanceEther.isValidSignature(
			dataProvider,
			OxTools.getDataOrderHash(Marketplace.address, DataOrder),
			DataOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the DataOrder signature");
		});

	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("Generate pool order", async () => {
		PoolOrder = OxTools.signMarket(
			{
				// market
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       3,
				// settings
				category:     4,
				trust:        1000,
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			poolScheduler,
			(obj) => OxTools.getPoolOrderHash(Marketplace.address, obj)
		);

		MarketplaceInstanceEther.getPoolOrderHash(
			PoolOrder
		).then(function (hash) {
			assert.strictEqual(hash, OxTools.getPoolOrderHash(Marketplace.address, PoolOrder), "Error with PoolOrder hash computation");
		});

		MarketplaceInstanceEther.isValidSignature(
			poolScheduler,
			OxTools.getPoolOrderHash(Marketplace.address, PoolOrder),
			PoolOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the PoolOrder signature");
		});

	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("Generate user order", async () => {
		UserOrder = OxTools.signMarket(
			{
				// market
				dapp:         DappInstance.address,
				dapppricemax: 3,
				data:         DataInstance.address,
				datapricemax: 1,
				pool:         PoolInstance.address,
				poolpricemax: 25,
				// settings
				category:     4,
				trust:        1000,
				requester:    user,
				beneficiary:  user,
				callback:     '0x0000000000000000000000000000000000000000',
				params:       "echo HelloWorld",
				// extra
				salt:         ethers.utils.randomBytes(32),
			},
			user,
			(obj) => OxTools.getUserOrderHash(Marketplace.address, obj)
		);

		MarketplaceInstanceEther.getUserOrderHash(
			UserOrder
		).then(function (hash) {
			assert.strictEqual(hash, OxTools.getUserOrderHash(Marketplace.address, UserOrder), "Error with UserOrder hash computation");
		});

		MarketplaceInstanceEther.isValidSignature(
			user,
			OxTools.getUserOrderHash(Marketplace.address, UserOrder),
			UserOrder.sign
		).then(function(result) {
			assert.strictEqual(result, true, "Error with the validation of the UserOrder signature");
		});

	});


	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[RUN] check Balances - Before", async () => {
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolScheduler)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker1)
		assert.strictEqual(balance[0].toNumber(),  990, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),   10, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker2)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(poolWorker3)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
		balance = await MarketplaceInstance.viewAccountLegacy.call(user)
		assert.strictEqual(balance[0].toNumber(), 1000, "check balance stake locked");
		assert.strictEqual(balance[1].toNumber(),    0, "check balance stake locked");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it("[RUN] matchOrders", async () => {
		MarketplaceInstanceEther.matchOrders(
			DappOrder,
			DataOrder,
			PoolOrder,
			UserOrder
		).then(function(result) {
			console.log("MatchOrder:", result);
			// event OrdersMatched
		});
	});

	//it("viewDeal", async () => {});
	//it("viewWorkorder", async () => {});
	it("[RUN] allowWorkerToContribute", async () => {});
	it("[RUN] contribute", async () => {});
	//it("viewContribution", async () => {});
	it("[RUN] revealConsensus", async () => {});
	it("[RUN] reveal", async () => {});
	it("[RUN] finalizeWork", async () => {});
	it("[RUN] check Balances - After", async () => {});



});
