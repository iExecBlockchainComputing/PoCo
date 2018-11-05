var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Relay        = artifacts.require("./Relay.sol");
var Broker       = artifacts.require("./Broker.sol");

var IexecHubABILegacy   = artifacts.require("./IexecHubABILegacy.sol");
var IexecClerkABILegacy = artifacts.require("./IexecClerkABILegacy.sol");

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
	var RelayInstance        = null;
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
			{ address: poolWorker1, enclave: sgxEnclave,             raw: "iExec the wanderer" },
			{ address: poolWorker2, enclave: constants.NULL.ADDRESS, raw: "iExec the wanderer" },
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
		RelayInstance        = await Relay.deployed();
		BrokerInstance       = await Broker.deployed();

		/**
		 * For ABILegacy
		 */
		IexecHubInstance   = await IexecHubABILegacy.at(IexecHubInstance.address);
		IexecClerkInstance = await IexecClerkABILegacy.at(IexecClerkInstance.address);

		/**
		 * Domain setup
		 */
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
		IexecClerkInstanceBeta = new web3.eth.Contract(IexecClerk.abi, IexecClerkInstance.address); // Full abi needed here

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
				tag:          0,
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
				tag:          0,
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
				tag:          0,
				category:     4,
				trust:        1000,
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
				tag:          0,
				category:     4,
				trust:        1000,
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
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolScheduler }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker1   }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker2   }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker3   }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker4   }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: user          }),
		]);
		assert.isBelow(txsMined[0].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Setup] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
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

		IexecClerkInstance.viewAccountABILegacy(poolWorker1).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 990, 10 ], "check balance"));
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

		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[Initial] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
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

		assert.equal(txMined.events.SchedulerNotice.returnValues.pool,   PoolInstance.address,                    "error");
		assert.equal(txMined.events.SchedulerNotice.returnValues.dealid, dealid,                                  "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dealid,   dealid,                                  "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dappHash, odbtools.DappOrderStructHash(dapporder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dataHash, odbtools.DataOrderStructHash(dataorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.poolHash, odbtools.PoolOrderStructHash(poolorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.userHash, odbtools.UserOrderStructHash(userorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.volume,   1,                                       "error");
	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("[Market] Check deal", async () => {
		deal_pt1 = await IexecClerkInstance.viewDealABILegacy_pt1(dealid);
		assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , DappInstance.address,   "check deal (deal.dapp.pointer)"        );
		assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , userorder.dapp,         "check deal (deal.dapp.pointer)"        );
		assert.equal    (deal_pt1[1]            /*dapp.owner*/   , dappProvider,           "check deal (deal.dapp.owner)"          );
		assert.equal    (deal_pt1[2].toNumber() /*dapp.price*/   , dapporder.dappprice,    "check deal (deal.dapp.price)"          );
		assert.isAtMost (deal_pt1[2].toNumber() /*dapp.price*/   , userorder.dappmaxprice, "check deal (deal.dapp.price)"          );
		assert.equal    (deal_pt1[3]            /*data.pointer*/ , DataInstance.address,   "check deal (deal.data.pointer)"        );
		assert.equal    (deal_pt1[3]            /*data.pointer*/ , userorder.data,         "check deal (deal.data.pointer)"        );
		assert.equal    (deal_pt1[4]            /*data.owner*/   , dataProvider,           "check deal (deal.data.owner)"          );
		assert.equal    (deal_pt1[5].toNumber() /*data.price*/   , dataorder.dataprice,    "check deal (deal.data.price)"          );
		assert.isAtMost (deal_pt1[5].toNumber() /*data.price*/   , userorder.datamaxprice, "check deal (deal.data.price)"          );
		assert.equal    (deal_pt1[6]            /*pool.pointer*/ , PoolInstance.address,   "check deal (deal.pool.pointer)"        );
		if( userorder.pool != constants.NULL.ADDRESS)
		assert.equal    (deal_pt1[6]            /*pool.pointer*/ , userorder.pool,         "check deal (deal.pool.pointer)"        );
		assert.equal    (deal_pt1[7]            /*pool.owner*/   , poolScheduler,          "check deal (deal.pool.owner)"          );
		assert.equal    (deal_pt1[8].toNumber() /*pool.price*/   , poolorder.poolprice,    "check deal (deal.pool.price)"          );
		assert.isAtMost (deal_pt1[8].toNumber() /*pool.price*/   , userorder.poolmaxprice, "check deal (deal.pool.price)"          );

		deal_pt2 = await IexecClerkInstance.viewDealABILegacy_pt2(dealid);
		assert.equal    (deal_pt2[0].toNumber(), poolorder.trust,        "check deal (deal.trust)"       );
		assert.isAtLeast(deal_pt2[0].toNumber(), userorder.trust,        "check deal (deal.trust)"       );
		assert.equal    (deal_pt2[1].toNumber(), poolorder.tag,          "check deal (deal.tag)"         );
		assert.equal    (deal_pt2[1].toNumber(), userorder.tag,          "check deal (deal.tag)"         );
		assert.equal    (deal_pt2[2],            user,                   "check deal (deal.requester)"   );
		assert.equal    (deal_pt2[3],            user,                   "check deal (deal.beneficiary)" );
		assert.equal    (deal_pt2[4],            userorder.callback,     "check deal (deal.callback)"    );
		assert.equal    (deal_pt2[5],            userorder.params,       "check deal (deal.params)"      );
	});

	/***************************************************************************
	 *                     TEST: specs are written onchain                     *
	 ***************************************************************************/
	it("[Market] Check config", async () => {
		config = await IexecClerkInstance.viewConfigABILegacy(dealid);
		assert.equal  (config[0].toNumber(), poolorder.category, "check config (config.category)"            );
		assert.equal  (config[0].toNumber(), userorder.category, "check config (config.category)"            );
		assert.isAbove(config[1].toNumber(), 0,                  "check config (config.start)"               );
		assert.equal  (config[2].toNumber(), 0,                  "check config (config.botFirst)"            );
		assert.equal  (config[3].toNumber(), 1,                  "check config (config.botSize)"             );
		assert.equal  (config[4].toNumber(), 8,                  "check config (config.workerStake)"         ); // 8 = floor(25*.3)
		assert.equal  (config[5].toNumber(), 5,                  "check config (config.schedulerRewardRatio)");
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("[Market] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  990, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                    TEST: scheduler initializes task                     *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(dealid, 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		taskid = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.taskid, taskid,               "check taskid");
		assert.equal(events[0].args.pool,   PoolInstance.address, "check pool");
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("[Initialized] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[0].toNumber(), constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (task[1],            dealid,                          "check task (task.dealid)"           );
		assert.equal    (task[2].toNumber(), 0,                               "check task (task.idx)"              );
		assert.isAbove  (task[3].toNumber(), 0,                               "check task (task.consensusDeadline)");
		assert.equal    (task[4],            constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.equal    (task[5].toNumber(), 0,                               "check task (task.revealDeadline)"   );
		assert.equal    (task[6].toNumber(), 0,                               "check task (task.revealCounter)"    );
		assert.equal    (task[7].toNumber(), 0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(task[8],            [],                              "check task (task.contributors)"     );
		assert.equal    (task[9],            null,                            "check task (task.results)"          );
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
			results[w.address] = odbtools.sealResult(w.raw, w.address);
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
			txMined = await IexecHubInstance.contributeABILegacy(
				authorizations[w.address].taskid, // task (authorization)
				results[w.address].hash,          // common    (result)
				results[w.address].seal,          // unique    (result)
				w.enclave,                        // address   (enclave)
				results[w.address].sign.v,        // signature (enclave)
				results[w.address].sign.r,        // signature (enclave)
				results[w.address].sign.s,        // signature (enclave)
				authorizations[w.address].sign.v, // signature (authorization)
				authorizations[w.address].sign.r, // signature (authorization)
				authorizations[w.address].sign.s, // signature (authorization)
				{ from: w.address }
			);

			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			events = extractEvents(txMined, IexecHubInstance.address, "TaskContribute");
			assert.equal(events[0].args.taskid, authorizations[w.address].taskid, "check taskid");
			assert.equal(events[0].args.worker, w.address,                        "check worker");
			assert.equal(events[0].args.hash,   results[w.address].hash,          "check hash");
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed] Check contribution", async () => {
		for (w of workers)
		{
			contribution = await IexecHubInstance.viewContributionABILegacy(taskid, w.address);
			assert.equal(contribution[0],            constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution[1],            results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
			assert.equal(contribution[2],            results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
			assert.equal(contribution[3],            w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
			assert.equal(contribution[4].toNumber(), 0,                                            "check contribution (contribution.score)"           );
			assert.equal(contribution[5].toNumber(), 1,                                            "check contribution (contribution.weight)"          );
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  982, 18 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  982, 18 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Contributed] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[0].toNumber(), constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (task[1],            dealid,                          "check task (task.dealid)"           );
		assert.equal    (task[2].toNumber(), 0,                               "check task (task.idx)"              );
		assert.isAbove  (task[3].toNumber(), 0,                               "check task (task.consensusDeadline)");
		assert.equal    (task[4],            constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.equal    (task[5].toNumber(), 0,                               "check task (task.revealDeadline)"   );
		assert.equal    (task[6].toNumber(), 0,                               "check task (task.revealCounter)"    );
		assert.equal    (task[7].toNumber(), 0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(task[8],            workers.map(x => x.address),     "check task (task.contributors)"     );
		assert.equal    (task[9],            null,                            "check task (task.results)"          );
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it(">> consensus", async () => {
		txMined = await IexecHubInstance.consensus(taskid, consensus.hash, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskConsensus");
		assert.equal(events[0].args.taskid,    taskid,         "check taskid"     );
		assert.equal(events[0].args.consensus, consensus.hash, "check consensus");
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Consensus] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[0].toNumber(), constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (task[1],            dealid,                             "check task (task.dealid)"           );
		assert.equal    (task[2].toNumber(), 0,                                  "check task (task.idx)"              );
		assert.isAbove  (task[3].toNumber(), 0,                                  "check task (task.consensusDeadline)");
		assert.equal    (task[4],            consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (task[5].toNumber(), 0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (task[6].toNumber(), 0,                                  "check task (task.revealCounter)"    );
		assert.equal    (task[7].toNumber(), workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(task[8],            workers.map(x => x.address),        "check task (task.contributors)"     );
		assert.equal    (task[9],            null,                               "check task (task.results)"          );
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (w of workers)
		if (results[w.address].hash == consensus.hash)
		{
			txMined = await IexecHubInstance.reveal(
				taskid,
				results[w.address].digest,
				{ from: w.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskReveal");
			assert.equal(events[0].args.taskid, taskid,                    "check taskid");
			assert.equal(events[0].args.worker, w.address,                 "check worker");
			assert.equal(events[0].args.digest, results[w.address].digest, "check digest");
		}
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Reveal] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[0].toNumber(), constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (task[1],            dealid,                             "check task (task.dealid)"           );
		assert.equal    (task[2].toNumber(), 0,                                  "check task (task.idx)"              );
		assert.isAbove  (task[3].toNumber(), 0,                                  "check task (task.consensusDeadline)");
		assert.equal    (task[4],            consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (task[5].toNumber(), 0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (task[6].toNumber(), workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (task[7].toNumber(), workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(task[8],            workers.map(x => x.address),        "check task (task.contributors)"     );
		assert.equal    (task[9],            null,                               "check task (task.results)"          );
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

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  taskid,                          "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"), "check consensus (results)");

		// TODO: check 2 events by w.address for w in workers
		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[0].toNumber(), constants.TaskStatusEnum.COMPLETED, "check task (task.status)"           );
		assert.equal    (task[1],            dealid,                             "check task (task.dealid)"           );
		assert.equal    (task[2].toNumber(), 0,                                  "check task (task.idx)"              );
		assert.isAbove  (task[3].toNumber(), 0,                                  "check task (task.consensusDeadline)");
		assert.equal    (task[4],            consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (task[5].toNumber(), 0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (task[6].toNumber(), workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (task[7].toNumber(), workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(task[8],            workers.map(x => x.address),        "check task (task.contributors)"     );
		assert.equal    (task[9],            web3.utils.utf8ToHex("aResult"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(dataProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    1,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(dappProvider ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    3,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolScheduler).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1003,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker1  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1001, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker2  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1001, 10 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker3  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(poolWorker4  ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user         ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	it("FINISHED", async () => {});

});
