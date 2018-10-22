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

const Web3      = require('web3')
const constants = require("./constants");
const odbtools  = require('../utils/odb-tools');

const wallets   = require('./wallets');

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

	var dapporder = null;
	var dataorder = null;
	var poolorder = null;
	var userorder = null;
	var dealid    = null;
	var taskid    = null;

	var authorizations = {};
	var results        = {};
	var consensus      = null;
	var workers        = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		workers = [
			{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec the wanderer" },
			{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec the wanderer" },
		];
		consensus = odbtools.hashResult("iExec the wanderer");

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

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * For ABIEncoderV2
		 */
		web3 = new Web3(web3.currentProvider);
		IexecHubInstanceBeta   = new web3.eth.Contract(IexecHubInstance.abi,   IexecHubInstance.address  );
		IexecClerkInstanceBeta = new web3.eth.Contract(IexecClerkInstance.abi, IexecClerkInstance.address);

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
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
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
	it("[Genesis] Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("[Genesis] Pool Creation", async () => {
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
		PoolInstance = await Pool.at(events[0].args.pool);
	});

	/***************************************************************************
	 *               TEST: Pool configuration (by poolScheduler)               *
	 ***************************************************************************/
	it("[Genesis] Pool Configuration", async () => {
		txMined = await PoolInstance.changePoolPolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *              TEST: Dapp order signature (by dappProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate dapp order", async () => {
		dapporder = odbtools.signDappOrder(
			{
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dappProvider)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				dappProvider,
				odbtools.DappOrderStructHash(dapporder),
				dapporder.sign
			).call(),
			"Error with the validation of the dapporder signature"
		);
	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate data order", async () => {
		dataorder = odbtools.signDataOrder(
			{
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				dataProvider,
				odbtools.DataOrderStructHash(dataorder),
				dataorder.sign
			).call(),
			"Error with the validation of the dataorder signature"
		);
	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate pool order", async () => {
		poolorder = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       3,
				category:     4,
				trust:        1000,
				tag:          0,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				poolScheduler,
				odbtools.PoolOrderStructHash(poolorder),
				poolorder.sign
			).call(),
			"Error with the validation of the poolorder signature"
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1, // CHANGE FOR BOT
				category:     4,
				trust:        1000,
				tag:          0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				user,
				odbtools.UserOrderStructHash(userorder),
				userorder.sign
			).call(),
			"Error with the validation of the userorder signature"
		);
	});

	it("[LOG] show order", async () => {
		console.log("=== dapporder ===");
		console.log(dapporder);
		console.log("=== dataorder ===");
		console.log(dataorder);
		console.log("=== poolorder ===");
		console.log(poolorder);
		console.log("=== userorder ===");
		console.log(userorder);
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Genesis] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: poolScheduler }),
			IexecClerkInstance.deposit(1000, { from: poolWorker1   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker2   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker3   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker4   }),
			IexecClerkInstance.deposit(1000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// UNSAFE TEST: Promise all doest not handle events correctly
		/*
		events = extractEvents(txsMined[0], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  poolScheduler, "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		events = extractEvents(txsMined[1], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  poolWorker1,   "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		events = extractEvents(txsMined[2], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  poolWorker2,   "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		events = extractEvents(txsMined[3], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  poolWorker3,   "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		events = extractEvents(txsMined[4], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  poolWorker4,   "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		events = extractEvents(txsMined[5], IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  user,          "check deposit recipient");
		assert.equal(events[0].args.amount, 1000,          "check deposit amount");
		*/
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Setup] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: Worker join the pool                        *
	 ***************************************************************************/
	it("[Setup] Worker join", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker1), constants.NULL.ADDRESS, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker2), constants.NULL.ADDRESS, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker3), constants.NULL.ADDRESS, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker4), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker1 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker1,          "check worker");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker2 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker2,          "check worker");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker3 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker3,          "check worker");

		txMined = await IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker4 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker4,          "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(poolWorker1), PoolInstance.address, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker2), PoolInstance.address, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker3), PoolInstance.address, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker4), PoolInstance.address, "affectation issue");

		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: Worker leave the pool                       *
	 ***************************************************************************/
	it("[Setup] Worker unsubscription & eviction", async () => {

		txMined = await IexecHubInstance.unsubscribe({ from: poolWorker3 }),
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerUnsubscription");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker3,          "check worker");

		txMined = await IexecHubInstance.evict(poolWorker4, { from: poolScheduler }),
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerEviction");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool"  );
		assert.equal(events[0].args.worker, poolWorker4,          "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(poolWorker1), PoolInstance.address,   "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker2), PoolInstance.address,   "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker3), constants.NULL.ADDRESS, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker4), constants.NULL.ADDRESS, "affectation issue");

		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[Initial] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)).toNumber(), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)).toNumber(), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)).toNumber(), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)).toNumber(), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstanceBeta.methods.matchOrders(dapporder, dataorder, poolorder, userorder).send({ from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		dealid = web3.utils.soliditySha3(
			{ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder) },
			{ t: 'uint256', v: 0                                       },
		);

		assert(txMined.events.SchedulerNotice.returnValues.pool,   PoolInstance.address,                    "error");
		assert(txMined.events.SchedulerNotice.returnValues.dealid, dealid,                                  "error");
		assert(txMined.events.OrdersMatched.returnValues.dealid,   dealid,                                  "error");
		assert(txMined.events.OrdersMatched.returnValues.dappHash, odbtools.DappOrderStructHash(dapporder), "error");
		assert(txMined.events.OrdersMatched.returnValues.dataHash, odbtools.DataOrderStructHash(dataorder), "error");
		assert(txMined.events.OrdersMatched.returnValues.poolHash, odbtools.PoolOrderStructHash(poolorder), "error");
		assert(txMined.events.OrdersMatched.returnValues.userHash, odbtools.UserOrderStructHash(userorder), "error");
		assert(txMined.events.OrdersMatched.returnValues.volume,   1,                                       "error");
	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("[Market] Check deal", async () => {
		deal = await IexecClerkInstanceBeta.methods.viewDeal(dealid).call();
		console.log(deal);
		assert.equal    (       deal.dapp.pointer, DappInstance.address,   "check deal (deal.dapp.pointer)"        );
		assert.equal    (       deal.dapp.owner,   dappProvider,           "check deal (deal.dapp.owner)"          );
		assert.equal    (Number(deal.dapp.price),  dapporder.dappprice,    "check deal (deal.dapp.price)"          );
		assert.equal    (       deal.dapp.pointer, userorder.dapp,         "check deal (deal.dapp.pointer)"        );
		assert.isAtMost (Number(deal.dapp.price),  userorder.dappmaxprice, "check deal (deal.dapp.price)"          );
		assert.equal    (       deal.data.pointer, DataInstance.address,   "check deal (deal.data.pointer)"        );
		assert.equal    (       deal.data.owner,   dataProvider,           "check deal (deal.data.owner)"          );
		assert.equal    (Number(deal.data.price),  dataorder.dataprice,    "check deal (deal.data.price)"          );
		assert.equal    (       deal.data.pointer, userorder.data,         "check deal (deal.data.pointer)"        );
		assert.isAtMost (Number(deal.data.price),  userorder.datamaxprice, "check deal (deal.data.price)"          );
		assert.equal    (       deal.pool.pointer, PoolInstance.address,   "check deal (deal.pool.pointer)"        );
		assert.equal    (       deal.pool.owner,   poolScheduler,          "check deal (deal.pool.owner)"          );
		assert.equal    (Number(deal.pool.price),  poolorder.poolprice,    "check deal (deal.pool.price)"          );
		if( userorder.pool != constants.NULL.ADDRESS)
		assert.equal    (       deal.pool.pointer, userorder.pool,         "check deal (deal.pool.pointer)"        );
		assert.isAtMost (Number(deal.pool.price),  userorder.poolmaxprice, "check deal (deal.pool.price)"          );
		assert.equal    (Number(deal.trust),       poolorder.trust,        "check deal (deal.trust)"               );
		assert.isAtLeast(Number(deal.trust),       userorder.trust,        "check deal (deal.trust)"               );
		assert.equal    (Number(deal.tag),         poolorder.tag,          "check deal (deal.tag)"                 );
		assert.equal    (Number(deal.tag),         userorder.tag,          "check deal (deal.tag)"                 );
		assert.equal    (       deal.requester,    user,                   "check deal (deal.requester)"           );
		assert.equal    (       deal.beneficiary,  user,                   "check deal (deal.beneficiary)"         );
		assert.equal    (       deal.callback,     userorder.callback,     "check deal (deal.callback)"            );
		assert.equal    (       deal.params,       userorder.params,       "check deal (deal.params)"              );
	});

	/***************************************************************************
	 *                     TEST: specs are written onchain                     *
	 ***************************************************************************/
	it("[Market] Check config", async () => {
		config = await IexecClerkInstanceBeta.methods.viewConfig(dealid).call();
		assert.equal  (Number(config.category            ), poolorder.category, "check config (config.category)"            );
		assert.equal  (Number(config.category            ), userorder.category, "check config (config.category)"            );
		assert.isAbove(Number(config.startTime           ), 0,                  "check config (config.start)"               );
		assert.equal  (Number(config.botFirst            ), 0,                  "check config (config.botFirst)"            );
		assert.equal  (Number(config.botSize             ), 1,                  "check config (config.botSize)"             );
		assert.equal  (Number(config.workerStake         ), 8,                  "check config (config.workerStake)"         ); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5,                  "check config (config.schedulerRewardRatio)");
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("[Market] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  993,  7 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                    TEST: scheduler initializes task                     *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(dealid, 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");

		taskid = events[0].args.taskid;
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("[Initialized] Check task", async () => {
		task = await IexecHubInstanceBeta.methods.viewTask(taskid).call();
		assert.equal    (       task.status,             constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (       task.dealid,             dealid,                          "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),               0,                               "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,     constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline), 0,                               "check task (task.consensusDeadline)");
		assert.equal    (Number(task.revealDeadline),    0,                               "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),     0,                               "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),     0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors,       [],                              "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
		for (w of workers)
		{
			authorizations[w.address] = await odbtools.signAuthorization(
				{
					worker:  w.address,
					taskid:  taskid,
					enclave: w.enclave,
					sign:    constants.NULL.SIGNATURE,
				},
				poolScheduler
			);
		}
	});

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it(">> Run job", async () => {
		for (w of workers)
		{
			results[w.address] = odbtools.signResult(w.raw, w.address);
			if (w.enclave != constants.NULL.ADDRESS) // With SGX
			{
				await odbtools.signContribution(results[w.address], w.enclave);
			}
			else // Without SGX
			{
				results[w.address].sign = constants.NULL.SIGNATURE;
			}
		}
	});

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it(">> signed contribute", async () => {
		for (w of workers)
		{
			txMined = await IexecHubInstanceBeta.methods.contribute(
				authorizations[w.address].taskid,     // task (authorization)
				results[w.address].contribution.hash, // common    (result)
				results[w.address].contribution.sign, // unique    (result)
				w.enclave,                            // address   (enclave)
				results[w.address].sign,              // signature (enclave)
				authorizations[w.address].sign,       // signature (authorization)
			).send({ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			assert(txMined.events.TaskContribute.returnValues.taskid, authorizations[w.address].taskid,     "error");
			assert(txMined.events.TaskContribute.returnValues.worker, w.address,                            "error");
			assert(txMined.events.TaskContribute.returnValues.sealed, results[w.address].contribution.hash, "error");
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed] Check contribution", async () => {
		for (w of workers)
		{
			contribution = await IexecHubInstanceBeta.methods.viewContribution(taskid, w.address).call();
			assert.equal(contribution.status,           constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution.resultHash,       results[w.address].contribution.hash,         "check contribution (contribution.resultHash)"      );
			assert.equal(contribution.resultSign,       results[w.address].contribution.sign,         "check contribution (contribution.resultSign)"      );
			assert.equal(contribution.enclaveChallenge, w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
			assert.equal(contribution.score,            0,                                            "check contribution (contribution.score)"           );
			assert.equal(contribution.weight,           1,                                            "check contribution (contribution.weight)"          );
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  993,  7 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  982, 18 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  982, 18 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Contributed] Check task", async () => {
		task = await IexecHubInstanceBeta.methods.viewTask(taskid).call();
		assert.equal    (       task.status,                   constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                          "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                               "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                               "check task (task.consensusDeadline)");
		assert.equal    (Number(task.revealDeadline),          0,                               "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           0,                               "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),     "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it(">> revealConsensus", async () => {
		txMined = await IexecHubInstance.consensus(taskid, consensus.contribution.hash, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskConsensus");
		assert.equal(events[0].args.taskid,    taskid,                      "check taskid"     );
		assert.equal(events[0].args.consensus, consensus.contribution.hash, "check consensus");
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Consensus] Check task", async () => {
		task = await IexecHubInstanceBeta.methods.viewTask(taskid).call();
		assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.contribution.hash,        "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           0,                                  "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (w of workers)
		if (results[w.address].contribution.hash == consensus.contribution.hash)
		{
			txMined = await IexecHubInstance.reveal(
				taskid,
				results[w.address].base,
				{ from: w.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskReveal");
			assert.equal(events[0].args.taskid, taskid,                  "check taskid");
			assert.equal(events[0].args.worker, w.address,               "check worker");
			assert.equal(events[0].args.hash,   results[w.address].base, "check hash");
		}
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Reveal] Check task", async () => {
		task = await IexecHubInstanceBeta.methods.viewTask(taskid).call();
		assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.contribution.hash,        "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork", async () => {
		txMined = await IexecHubInstance.finalize(
			taskid,
			web3.utils.utf8ToHex("aResult"),
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalized");
		assert.equal(events[0].args.taskid,  taskid,                          "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"), "check consensus (results)");

		// TODO: check 2 events by w.address for w in workers
		// events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		// assert.equal(events[0].args.taskid,   taskid,      "check AccurateContribution (  taskid)");
		// assert.equal(events[0].args.worker, w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized] Check task", async () => {
		task = await IexecHubInstanceBeta.methods.viewTask(taskid).call();
		assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.contribution.hash,        "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
		assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    1,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    3,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1003,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1001, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1001, 10 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)).toNumber(), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)).toNumber(), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)).toNumber(), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)).toNumber(), 0, "score issue");
	});

	it("FINISHED", async () => {});

});
