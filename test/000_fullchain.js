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
const obdtools  = require('../utils/obd-tools');

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

	var dapporder = null;
	var dataorder = null;
	var poolorder = null;
	var userorder = null;

	var dealid    = null;
	var woid      = null;

	var authorizations = {};
	var results        = {};
	var consensus      = obdtools.hashResult("iExec the wanderer");
	var workers =
	[
		{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec the wanderer" },
		{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec the wanderer" },
	];

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var BeaconInstanceEthers     = null;
	var BrokerInstanceEthers     = null;

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
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", { from: dataProvider });
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
		dapporder = obdtools.signObject(
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
			(obj) => obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(obj), obj.salt)
		);

		assert.equal(
			await IexecClerkInstanceEthers.getDappOrderHash(dapporder),
			obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(dapporder), dapporder.salt),
			"Error with dapporder hash computation"
		);

		assert.isTrue(
			await IexecClerkInstanceEthers.isValidSignature(
				dappProvider,
				obdtools.getFullHash(IexecClerkInstance.address, obdtools.dappPartialHash(dapporder), dapporder.salt),
				dapporder.sign
			),
			"Error with the validation of the dapporder signature"
		);

	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate data order", async () => {
		dataorder = obdtools.signObject(
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
			(obj) => obdtools.getFullHash(IexecClerkInstance.address, obdtools.dataPartialHash(obj), obj.salt)
		);

		assert.equal(
			await IexecClerkInstanceEthers.getDataOrderHash(dataorder),
			obdtools.getFullHash(IexecClerkInstance.address, obdtools.dataPartialHash(dataorder), dataorder.salt),
			"Error with dataorder hash computation"
		);

		assert.isTrue(
			await IexecClerkInstanceEthers.isValidSignature(
				dataProvider,
				obdtools.getFullHash(IexecClerkInstance.address, obdtools.dataPartialHash(dataorder), dataorder.salt),
				dataorder.sign
			),
			"Error with the validation of the dataorder signature"
		);
	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate pool order", async () => {
		poolorder = obdtools.signObject(
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
			(obj) => obdtools.getFullHash(IexecClerkInstance.address, obdtools.poolPartialHash(obj), obj.salt)
		);

		assert.equal(
			await IexecClerkInstanceEthers.getPoolOrderHash(poolorder),
			obdtools.getFullHash(IexecClerkInstance.address, obdtools.poolPartialHash(poolorder), poolorder.salt),
			"Error with poolorder hash computation"
		);

		assert.isTrue(
			await IexecClerkInstanceEthers.isValidSignature(
				poolScheduler,
				obdtools.getFullHash(IexecClerkInstance.address, obdtools.poolPartialHash(poolorder), poolorder.salt),
				poolorder.sign
			),
			"Error with the validation of the poolorder signature"
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = obdtools.signObject(
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
			(obj) => obdtools.getFullHash(IexecClerkInstance.address, obdtools.userPartialHash(obj), obj.salt)
		);

		assert.equal(
			await IexecClerkInstanceEthers.getUserOrderHash(userorder),
			obdtools.getFullHash(IexecClerkInstance.address, obdtools.userPartialHash(userorder), userorder.salt),
			"Error with userorder hash computation"
		);

		assert.isTrue(
			await IexecClerkInstanceEthers.isValidSignature(
				user,
				obdtools.getFullHash(IexecClerkInstance.address, obdtools.userPartialHash(userorder), userorder.salt),
				userorder.sign
			),
			"Error with the validation of the userorder signature"
		);
	});


	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Genesis] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 0, 0 ], "check balance");
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
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000, 0 ], "check balance");
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

		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1)).map(x => x.toNumber()), [ 990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2)).map(x => x.toNumber()), [ 990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3)).map(x => x.toNumber()), [ 990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4)).map(x => x.toNumber()), [ 990, 10 ], "check balance");
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

		assert.equal(await IexecHubInstance.viewAffectation(poolWorker1), PoolInstance.address, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker2), PoolInstance.address, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker3), constants.NULL.ADDRESS, "affectation issue");
		assert.equal(await IexecHubInstance.viewAffectation(poolWorker4), constants.NULL.ADDRESS, "affectation issue");

		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1)).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2)).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3)).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4)).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[Initial] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {

		txNotMined = await IexecClerkInstanceEthers
		.connect(jsonRpcProvider.getSigner(user))
		.matchOrders(
			dapporder,
			dataorder,
			poolorder,
			userorder,
			{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		// console.log("txNotMined:", txNotMined);

		// txReceipt = await txNotMined.wait(); // SLOW!!!
		// console.log("txReceipt:", txReceipt);

		// TODO: check gas, events ...

		dealid = obdtools.getFullHash(IexecClerkInstance.address, obdtools.userPartialHash(userorder), userorder.salt);
	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("[Market] Check deal", async () => {
		deal = await IexecClerkInstanceEthers.viewDeal(dealid);
		assert.equal    (deal.dapp.pointer.toLowerCase(), DappInstance.address,   "check deal (deal.dapp.pointer)"        );
		assert.equal    (deal.dapp.owner.toLowerCase(),   dappProvider,           "check deal (deal.dapp.owner)"          );
		assert.equal    (deal.dapp.price,                 dapporder.dappprice,    "check deal (deal.dapp.price)"          );
		assert.equal    (deal.dapp.pointer.toLowerCase(), userorder.dapp,         "check deal (deal.dapp.pointer)"        );
		assert.isAtMost (deal.dapp.price.toNumber(),      userorder.dappmaxprice, "check deal (deal.dapp.price)"          );
		assert.equal    (deal.data.pointer.toLowerCase(), DataInstance.address,   "check deal (deal.data.pointer)"        );
		assert.equal    (deal.data.owner.toLowerCase(),   dataProvider,           "check deal (deal.data.owner)"          );
		assert.equal    (deal.data.price,                 dataorder.dataprice,    "check deal (deal.data.price)"          );
		assert.equal    (deal.data.pointer.toLowerCase(), userorder.data,         "check deal (deal.data.pointer)"        );
		assert.isAtMost (deal.data.price.toNumber(),      userorder.datamaxprice, "check deal (deal.data.price)"          );
		assert.equal    (deal.pool.pointer.toLowerCase(), PoolInstance.address,   "check deal (deal.pool.pointer)"        );
		assert.equal    (deal.pool.owner.toLowerCase(),   poolScheduler,          "check deal (deal.pool.owner)"          );
		assert.equal    (deal.pool.price,                 poolorder.poolprice,    "check deal (deal.pool.price)"          );
		if( userorder.pool != constants.NULL.ADDRESS)
		assert.equal    (deal.pool.pointer.toLowerCase(), userorder.pool,         "check deal (deal.pool.pointer)"        );
		assert.isAtMost (deal.pool.price.toNumber(),      userorder.poolmaxprice, "check deal (deal.pool.price)"          );
		assert.equal    (deal.category,                   poolorder.category,     "check deal (deal.category)"            );
		assert.equal    (deal.category,                   userorder.category,     "check deal (deal.category)"            );
		assert.equal    (deal.trust,                      poolorder.trust,        "check deal (deal.trust)"               );
		assert.isAtLeast(deal.trust.toNumber(),           userorder.trust,        "check deal (deal.trust)"               );
		assert.equal    (deal.tag,                        poolorder.tag,          "check deal (deal.tag)"                 );
		assert.equal    (deal.tag,                        userorder.tag,          "check deal (deal.tag)"                 );
		assert.equal    (deal.requester.toLowerCase(),    user,                   "check deal (deal.requester)"           );
		assert.equal    (deal.beneficiary.toLowerCase(),  user,                   "check deal (deal.beneficiary)"         );
		assert.equal    (deal.callback.toLowerCase(),     userorder.callback,     "check deal (deal.callback)"            );
		assert.equal    (deal.params,                     userorder.params,       "check deal (deal.params)"              );
	});

	/***************************************************************************
	 *                     TEST: specs are written onchain                     *
	 ***************************************************************************/
	it("[Market] Check spec", async () => {
		spec = await IexecClerkInstanceEthers.viewSpec(dealid);
		assert.isAbove(spec.start.toNumber(),     0, "check spec (spec.start)"               ); // 8 = floor(25*.3)
		assert.equal  (spec.workerStake,          8, "check spec (spec.workerStake)"         ); // 8 = floor(25*.3)
		assert.equal  (spec.schedulerRewardRatio, 5, "check spec (spec.schedulerRewardRatio)");
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("[Market] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [  993,  7 ], "check balance"); // 8 = floor(25*.3)
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [  971, 29 ], "check balance"); // 29 = 25+3+1
	});

	/***************************************************************************
	 *                  TEST: scheduler initializes workorder                  *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(dealid, 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");

		woid = events[0].args.woid;
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("[Initialized] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                       constants.WorkOrderStatusEnum.ACTIVE, "check workorder (workorder.status)"           );
		assert.equal    (workorder.dealid,                       dealid,                               "check workorder (workorder.dealid)"           );
		assert.equal    (workorder.idx,                          0,                                    "check workorder (workorder.idx)"              );
		assert.equal    (workorder.consensusValue,               constants.NULL.BYTES32,               "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(), 0,                                    "check workorder (workorder.consensusDeadline)");
		assert.equal    (workorder.revealDeadline.toNumber(),    0,                                    "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),     0,                                    "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),     0,                                    "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors,                 [],                                   "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
		for (w of workers)
		{
			authorizations[w.address] = obdtools.signObject(
				{ worker: w.address, woid: woid, enclave: w.enclave },
				poolScheduler,
				(obj) => obdtools.authorizeHash(obj)
			);
		}

	});

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it(">> Run job", async () => {
		for (w of workers)
		{
			results[w.address] = obdtools.signResult(w.raw, w.address);
			if (w.enclave != constants.NULL.ADDRESS) // With SGX
			{
				obdtools.signObject(results[w.address], w.enclave, (obj) => obj.contribution.hash.substr(2,64) + obj.contribution.sign.substr(2,64));
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
			txNotMined = await IexecHubInstanceEthers
			.connect(jsonRpcProvider.getSigner(w.address))
			.signedContribute(
				authorizations[w.address].woid,       // workorder (authorization)
				results[w.address].contribution.hash, // common    (result)
				results[w.address].contribution.sign, // unique    (result)
				w.enclave,                            // address   (enclave)
				results[w.address].sign,              // signature (enclave)
				authorizations[w.address].sign,       // signature (authorization)
				{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
			// console.log("txNotMined:", txNotMined);
			// txReceipt = await txNotMined.wait(); // SLOW!!!
			// console.log("txReceipt:", txReceipt);
			// TODO: check gas, events ...
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed] Check contribution", async () => {
		for (w of workers)
		{
			contribution = await IexecHubInstanceEthers.viewContribution(woid, w.address);
			assert.equal(contribution.status,                         constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution.resultHash,                     results[w.address].contribution.hash,         "check contribution (contribution.resultHash)"      );
			assert.equal(contribution.resultSign,                     results[w.address].contribution.sign,         "check contribution (contribution.resultSign)"      );
			assert.equal(contribution.enclaveChallenge.toLowerCase(), w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
			assert.equal(contribution.score,                          0,                                            "check contribution (contribution.score)"           );
			assert.equal(contribution.weight,                         1,                                            "check contribution (contribution.weight)"          );
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [  993,  7 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [  982, 18 ], "check balance"); // 8 = floor(25*.35)
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [  982, 18 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [  971, 29 ], "check balance");
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Contributed] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.ACTIVE, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         constants.NULL.BYTES32,               "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                    "check workorder (workorder.consensusDeadline)");
		assert.equal    (workorder.revealDeadline.toNumber(),              0,                                    "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               0,                                    "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               0,                                    "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), workers.map(x => x.address),          "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it(">> revealConsensus", async () => {
		txMined = await IexecHubInstance.revealConsensus(woid, consensus.contribution.hash, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusRevealConsensus");
		assert.equal(events[0].args.woid,      woid,                        "check woid"     );
		assert.equal(events[0].args.consensus, consensus.contribution.hash, "check consensus");
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Consensus] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.REVEALING, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         consensus.contribution.hash,             "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               0,                                       "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               workers.length,                          "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), workers.map(x => x.address),             "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (w of workers)
		if (results[w.address].contribution.hash == consensus.contribution.hash)
		{
			txMined = await IexecHubInstance.reveal(
				woid,
				results[w.address].base,
				{ from: w.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "ConsensusReveal");
			assert.equal(events[0].args.woid,   woid,                    "check woid"  );
			assert.equal(events[0].args.worker, w.address,               "check worker");
			assert.equal(events[0].args.result, results[w.address].base, "check result");
		}
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Reveal] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.REVEALING, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         consensus.contribution.hash,             "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               workers.length,                          "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               workers.length,                          "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), workers.map(x => x.address),             "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork", async () => {
		txMined = await IexecHubInstance.finalizeWork(
			woid,
			"aStdout",
			"aStderr",
			"anUri",
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusFinalized");
		assert.equal(events[0].args.woid,   woid,      "check consensus (  woid)");
		assert.equal(events[0].args.stdout, "aStdout", "check consensus (stdout)");
		assert.equal(events[0].args.stderr, "aStderr", "check consensus (stderr)");
		assert.equal(events[0].args.uri,    "anUri",   "check consensus (   uri)");

		// TODO: check 2 events by w.address for w in workers
		// events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		// assert.equal(events[0].args.woid,                 woid,      "check AccurateContribution (  woid)");
		// assert.equal(events[0].args.worker.toLowerCase(), w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Finalized] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.COMPLETED, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         consensus.contribution.hash,             "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               workers.length,                          "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               workers.length,                          "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), workers.map(x => x.address),             "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    1,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    3,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1003,  0 ], "check balance"); //  +3
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1001, 10 ], "check balance"); // +11
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1001, 10 ], "check balance"); // +11
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000,  0 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [  971,  0 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	it("FINISHED", async () => {});

});
