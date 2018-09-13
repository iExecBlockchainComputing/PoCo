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
const odbtools  = require('../utils/odb-tools');

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

	var dapporder  = null;
	var dataorder  = null;
	var poolorder1 = null;
	var poolorder2 = null;
	var userorder  = null;

	var deals = null;
	var tasks  = {
		0:
		{
			woid: null,
			authorizations: {},
			results: {},
			consensus: odbtools.hashResult("iExec BOT 0"),
			workers :
			[
				{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec BOT 0" },
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 0" },
			]
		},
		1:
		{
			woid: null,
			authorizations: {},
			results: {},
			consensus: odbtools.hashResult("iExec BOT 1"),
			workers :
			[
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 1" },
				{ address: poolWorker3, enclave: sgxEnclave, raw: "iExec BOT 1" },
				{ address: poolWorker4, enclave: sgxEnclave, raw: "iExec BOT 1" },
			]
		},
		2:
		{
			woid: null,
			authorizations: {},
			results: {},
			consensus: odbtools.hashResult("iExec BOT 2"),
			workers :
			[
				{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec BOT 2" },
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 2" },
				{ address: poolWorker3, enclave: sgxEnclave, raw: "<timeout reached>" },
				{ address: poolWorker4, enclave: sgxEnclave, raw: "iExec BOT 2" },
			]
		},
	};


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
		dapporder = odbtools.signObject(
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
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.dappPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate data order", async () => {
		dataorder = odbtools.signObject(
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
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.dataPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate pool order", async () => {
		poolorder1 = odbtools.signObject(
			{
				// market
				pool:         PoolInstance.address,
				poolprice:    15,
				volume:       2,
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
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.poolPartialHash(obj), obj.salt)
		);
		poolorder2 = odbtools.signObject(
			{
				// market
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       10,
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
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.poolPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = odbtools.signObject(
			{
				// market
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				volume:       3,
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
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(obj), obj.salt)
		);
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
	});

	/***************************************************************************
	 *                       TEST: Worker join the pool                        *
	 ***************************************************************************/
	it("[Setup] Worker join", async () => {
		txsMined = await Promise.all([
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker1 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker2 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker3 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker4 }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
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
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [  990, 10 ], "check balance");
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
			poolorder1,
			userorder,
			{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		// console.log("txNotMined:", txNotMined);

		// txReceipt = await txNotMined.wait(); // SLOW!!!
		// console.log("txReceipt:", txReceipt);

		// TODO: check gas, events ...

		txNotMined = await IexecClerkInstanceEthers
		.connect(jsonRpcProvider.getSigner(user))
		.matchOrders(
			dapporder,
			dataorder,
			poolorder2,
			userorder,
			{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		// console.log("txNotMined:", txNotMined);

		// txReceipt = await txNotMined.wait(); // SLOW!!!
		// console.log("txReceipt:", txReceipt);

		// TODO: check gas, events ...
	});

	it("[matched] Check user deals", async () => {
		deals = await IexecClerkInstance.viewUserDeals(odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(userorder), userorder.salt));
		assert.equal(deals[0], ethers.utils.solidityKeccak256(['bytes32', 'uint256'],[odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(userorder), userorder.salt), 0]), "check dealid");
		assert.equal(deals[1], ethers.utils.solidityKeccak256(['bytes32', 'uint256'],[odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(userorder), userorder.salt), 2]), "check dealid");
	});

	/***************************************************************************
	 *                  TEST: scheduler initializes workorder                  *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(deals[0], 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[0].woid = events[0].args.woid;

		txMined = await IexecHubInstance.initialize(deals[0], 1, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[1].woid = events[0].args.woid;

		txMined = await IexecHubInstance.initialize(deals[1], 2, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[2].woid = events[0].args.woid;
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
		for (taskid in tasks)
		for (worker of tasks[taskid].workers)
		{
			tasks[taskid].authorizations[worker.address] = odbtools.signObject(
				{ worker: worker.address, woid: tasks[taskid].woid, enclave: worker.enclave },
				poolScheduler,
				(obj) => odbtools.authorizeHash(obj)
			);
		}
	});

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it(">> Run job", async () => {
		for (taskid in tasks)
		for (worker of tasks[taskid].workers)
		{
			tasks[taskid].results[worker.address] = odbtools.signResult(worker.raw, worker.address);
			if (worker.enclave != constants.NULL.ADDRESS) // With SGX
			{
				odbtools.signObject(tasks[taskid].results[worker.address], worker.enclave, (obj) => obj.contribution.hash.substr(2,64) + obj.contribution.sign.substr(2,64));
			}
			else // Without SGX
			{
				tasks[taskid].results[worker.address].sign = constants.NULL.SIGNATURE;
			}
		}
	});

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it(">> signed contribute", async () => {
		for (taskid in tasks)
		for (worker of tasks[taskid].workers)
		{
			txNotMined = await IexecHubInstanceEthers
			.connect(jsonRpcProvider.getSigner(worker.address))
			.signedContribute(
				tasks[taskid].authorizations[worker.address].woid,       // workorder (authorization)
				tasks[taskid].results[worker.address].contribution.hash, // common    (result)
				tasks[taskid].results[worker.address].contribution.sign, // unique    (result)
				worker.enclave,                                          // address   (enclave)
				tasks[taskid].results[worker.address].sign,              // signature (enclave)
				tasks[taskid].authorizations[worker.address].sign,       // signature (authorization)
				{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
			// console.log("txNotMined:", txNotMined);
			// txReceipt = await txNotMined.wait(); // SLOW!!!
			// console.log("txReceipt:", txReceipt);
			// TODO: check gas, events ...
		}
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it(">> revealConsensus", async () => {
		for (taskid in tasks)
		{
			txMined = await IexecHubInstance.revealConsensus(tasks[taskid].woid, tasks[taskid].consensus.contribution.hash, { from: poolScheduler });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "ConsensusRevealConsensus");
			assert.equal(events[0].args.woid,      tasks[taskid].woid,                        "check woid"     );
			assert.equal(events[0].args.consensus, tasks[taskid].consensus.contribution.hash, "check consensus");
		}
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (taskid in tasks)
		for (worker of tasks[taskid].workers)
		if (tasks[taskid].results[worker.address].contribution.hash == tasks[taskid].consensus.contribution.hash)
		{
			txMined = await IexecHubInstance.reveal(
				tasks[taskid].authorizations[worker.address].woid,
				tasks[taskid].results[worker.address].base,
				{ from: worker.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "ConsensusReveal");
			assert.equal(events[0].args.woid,   tasks[taskid].authorizations[worker.address].woid, "check woid"  );
			assert.equal(events[0].args.worker, worker.address,                                    "check worker");
			assert.equal(events[0].args.result, tasks[taskid].results[worker.address].base,        "check result");
		}
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Revealed] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0      +  0 +  0 +  0, 0                     ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0      +  0 +  0 +  0, 0                     ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000      -  4 -  4 -  7, 0      +  4 +  4 +  7 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1000 - 10 -  5      -  8, 0 + 10 +  5      +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1000 - 10 -  5 -  5 -  8, 0 + 10 +  5 +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000 - 10      -  5 -  8, 0 + 10      +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000 - 10      -  5 -  8, 0 + 10      +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000      - 19 - 19 - 29, 0      + 19 + 19 + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (1)", async () => {
		txMined = await IexecHubInstance.finalizeWork(
			tasks[0].woid,
			"aStdout 1",
			"aStderr 1",
			"anUri 1",
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusFinalized");
		assert.equal(events[0].args.woid,   tasks[0].woid, "check consensus (  woid)");
		assert.equal(events[0].args.stdout, "aStdout 1",   "check consensus (stdout)");
		assert.equal(events[0].args.stderr, "aStderr 1",   "check consensus (stderr)");
		assert.equal(events[0].args.uri,    "anUri 1",     "check consensus (   uri)");

		// TODO: check 2 events by w.address for w in workers
		// events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		// assert.equal(events[0].args.woid,                 woid,      "check AccurateContribution (  woid)");
		// assert.equal(events[0].args.worker.toLowerCase(), w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Finalized 1] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(tasks[0].woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.COMPLETED, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         tasks[0].consensus.contribution.hash,    "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               2,                                       "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               2,                                       "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), tasks[0].workers.map(x => x.address),    "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 1] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0      +  1 +  0 +  0, 0                ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0      +  3 +  0 +  0, 0                ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000      +  1 -  4 -  7, 0      +  4 +  7 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1000 - 10 +  7      -  8, 0 + 10      +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1000 - 10 +  7 -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000 - 10      -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000 - 10      -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000      - 19 - 19 - 29, 0      + 19 + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 1] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (2)", async () => {
		txMined = await IexecHubInstance.finalizeWork(
			tasks[1].woid,
			"aStdout 2",
			"aStderr 2",
			"anUri 2",
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusFinalized");
		assert.equal(events[0].args.woid,   tasks[1].woid, "check consensus (  woid)");
		assert.equal(events[0].args.stdout, "aStdout 2",   "check consensus (stdout)");
		assert.equal(events[0].args.stderr, "aStderr 2",   "check consensus (stderr)");
		assert.equal(events[0].args.uri,    "anUri 2",     "check consensus (   uri)");

		// TODO: check 2 events by w.address for w in workers
		// events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		// assert.equal(events[0].args.woid,                 woid,      "check AccurateContribution (  woid)");
		// assert.equal(events[0].args.worker.toLowerCase(), w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Finalized 2] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(tasks[1].woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.COMPLETED, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         tasks[1].consensus.contribution.hash,    "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               3,                                       "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               3,                                       "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), tasks[1].workers.map(x => x.address),    "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 2] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0      +  1 +  1 +  0, 0           ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0      +  3 +  3 +  0, 0           ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000      +  1 +  3 -  7, 0      +  7 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1000 - 10 +  7      -  8, 0 + 10 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1000 - 10 +  7 +  4 -  8, 0 + 10 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000 - 10      +  4 -  8, 0 + 10 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000 - 10      +  4 -  8, 0 + 10 +  8 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000      - 19 - 19 - 29, 0      + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 2] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)), 2, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)), 1, "score issue");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (3)", async () => {
		txMined = await IexecHubInstance.finalizeWork(
			tasks[2].woid,
			"aStdout 3",
			"aStderr 3",
			"anUri 3",
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "ConsensusFinalized");
		assert.equal(events[0].args.woid,   tasks[2].woid, "check consensus (  woid)");
		assert.equal(events[0].args.stdout, "aStdout 3",   "check consensus (stdout)");
		assert.equal(events[0].args.stderr, "aStderr 3",   "check consensus (stderr)");
		assert.equal(events[0].args.uri,    "anUri 3",     "check consensus (   uri)");

		// TODO: check 2 events by w.address for w in workers
		// events = extractEvents(txMined, IexecHubInstance.address, "AccurateContribution");
		// assert.equal(events[0].args.woid,                 woid,      "check AccurateContribution (  woid)");
		// assert.equal(events[0].args.worker.toLowerCase(), w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Finalized 3] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(tasks[2].woid);
		assert.equal    (workorder.status,                                 constants.WorkOrderStatusEnum.COMPLETED, "check workorder (workorder.status)"           );
		assert.equal    (workorder.consensusValue,                         tasks[2].consensus.contribution.hash,    "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(),           0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),              0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),               3,                                       "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),               3,                                       "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a.toLowerCase()), tasks[2].workers.map(x => x.address),    "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 3] Check balances", async () => {
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dataProvider )).map(x => x.toNumber()), [    0      +  1 +  1 +  1, 0      ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(dappProvider )).map(x => x.toNumber()), [    0      +  3 +  3 +  3, 0      ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolScheduler)).map(x => x.toNumber()), [ 1000      +  1 +  3 +  3, 0      ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker1  )).map(x => x.toNumber()), [ 1000 - 10 +  7      + 10, 0 + 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker2  )).map(x => x.toNumber()), [ 1000 - 10 +  7 +  4 + 10, 0 + 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker3  )).map(x => x.toNumber()), [ 1000 - 10      +  4 -  8, 0 + 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(poolWorker4  )).map(x => x.toNumber()), [ 1000 - 10      +  4 + 10, 0 + 10 ], "check balance");
		assert.deepEqual((await IexecClerkInstance.viewAccountLegacy(user         )).map(x => x.toNumber()), [ 1000      - 19 - 19 - 29, 0      ], "check balance");

	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 3] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)), 2, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)), 3, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)), 2, "score issue");
	});

	it("FINISHED", async () => {});

});
