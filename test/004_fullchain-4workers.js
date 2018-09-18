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
	var consensus      = null;
	var workers        = [];

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

		workers = [
			{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec the wanderer" },
			{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec the wanderer" },
			{ address: poolWorker3, enclave: sgxEnclave, raw: "iExec the wanderer" },
			{ address: poolWorker4, enclave: sgxEnclave, raw: "iExec the wanderer" },
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
		dapporder = await odbtools.signObject(
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
				sign:         constants.NULL.SIGNATURE,
			},
			dappProvider,
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.dappPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate data order", async () => {
		dataorder = await odbtools.signObject(
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
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			dataProvider,
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.dataPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate pool order", async () => {
		poolorder = await odbtools.signObject(
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
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			poolScheduler,
			(obj) => odbtools.getFullHash(IexecClerkInstance.address, odbtools.poolPartialHash(obj), obj.salt)
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = await odbtools.signObject(
			{
				// market
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				// pool:         PoolInstance.address,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1,
				// settings
				category:     4,
				trust:        1000,
				tag:          0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "<parameters>",
				// extra
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
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
		balance = await IexecClerkInstance.viewAccountLegacy(dataProvider ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [    0,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(dappProvider ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [    0,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolScheduler); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 1000,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker1  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker2  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker3  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker4  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(user         ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 1000,  0 ], "check balance");
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

		// TODO: get that from event
		dealid = web3.utils.soliditySha3(
			{ t: 'bytes32', v: odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(userorder), userorder.salt) },
			{ t: 'uint256', v: 0                                                                                                     },
		);
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
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
		for (w of workers)
		{
			authorizations[w.address] = await odbtools.signObject(
				{
					worker:  w.address,
					woid:    woid,
					enclave: w.enclave,
					sign:    constants.NULL.SIGNATURE,
				},
				poolScheduler,
				(obj) => odbtools.authorizeHash(obj)
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
				await odbtools.signObject(results[w.address], w.enclave, (obj) => odbtools.contributionHash(obj));
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
		// assert.equal(events[0].args.woid,   woid,      "check AccurateContribution (  woid)");
		// assert.equal(events[0].args.worker, w.address, "check AccurateContribution (worker)");

		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                      TEST: check workorder status                       *
	 ***************************************************************************/
	it("[Finalized] Check workorder", async () => {
		workorder = await IexecHubInstanceEthers.viewWorkorder(woid);
		assert.equal    (workorder.status,                       constants.WorkOrderStatusEnum.COMPLETED, "check workorder (workorder.status)"           );
		assert.equal    (workorder.dealid,                       dealid,                                  "check workorder (workorder.dealid)"           );
		assert.equal    (workorder.idx.toNumber(),               0,                                       "check workorder (workorder.idx)"              );
		assert.equal    (workorder.consensusValue,               consensus.contribution.hash,             "check workorder (workorder.consensusValue)"   );
		assert.isAbove  (workorder.consensusDeadline.toNumber(), 0,                                       "check workorder (workorder.consensusDeadline)");
		assert.isAbove  (workorder.revealDeadline.toNumber(),    0,                                       "check workorder (workorder.revealDeadline)"   );
		assert.equal    (workorder.revealCounter.toNumber(),     workers.length,                          "check workorder (workorder.revealCounter)"    );
		assert.equal    (workorder.winnerCounter.toNumber(),     workers.length,                          "check workorder (workorder.winnerCounter)"    );
		assert.deepEqual(workorder.contributors.map(a => a),     workers.map(x => x.address),             "check workorder (workorder.contributors)"     );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccountLegacy(dataProvider ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [    1,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(dappProvider ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [    3,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolScheduler); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 1005,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker1  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  995, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker2  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  995, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker3  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  995, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(poolWorker4  ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  995, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccountLegacy(user         ); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [  971,  0 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal((await IexecHubInstance.viewScore(poolWorker1)).toNumber(), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker2)).toNumber(), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker3)).toNumber(), 1, "score issue");
		assert.equal((await IexecHubInstance.viewScore(poolWorker4)).toNumber(), 1, "score issue");
	});

	it("FINISHED", async () => {});

});
