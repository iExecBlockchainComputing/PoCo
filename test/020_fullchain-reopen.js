var RLC          = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
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

	var dapporder  = null;
	var dataorder  = null;
	var poolorder1 = null;
	var poolorder2 = null;
	var userorder  = null;

	var deals = {}
	var tasks = {};

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
		RelayInstance        = await Relay.deployed();
		BrokerInstance       = await Broker.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

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
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);

		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);

		txMined = await PoolRegistryInstance.createPool(poolScheduler, "A test workerpool", /* lock*/ 10, /* minimum stake*/ 10, /* minimum score*/ 10, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);

		txMined = await PoolInstance.changePoolPolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, /* minimum stake */ 100, /* minimum score */ 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Workers
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

		// Orders
		dapporder = odbtools.signDappOrder(
			{
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				tag:          0x0,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dappProvider)
		);
		dataorder = odbtools.signDataOrder(
			{
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		poolorder = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       1,
				category:     4,
				trust:        1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		userorder = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1,
				category:     4,
				trust:        1000,
				tag:          0x0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,   0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	it("[setup] Match", async () => {
		// Market
		txMined = await IexecClerkInstance.matchOrders(dapporder, dataorder, poolorder, userorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.dappHash, odbtools.DappOrderStructHash(dapporder));
		assert.equal(events[0].args.dataHash, odbtools.DataOrderStructHash(dataorder));
		assert.equal(events[0].args.poolHash, odbtools.PoolOrderStructHash(poolorder));
		assert.equal(events[0].args.userHash, odbtools.UserOrderStructHash(userorder));
		assert.equal(events[0].args.volume,   1                                      );

		// Deals
		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(userorder));
		assert.equal(deals[0], events[0].args.dealid);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
	});

	function sendContribution(authorization, results)
	{
		return IexecHubInstance.contribute(
				authorization.taskid,                                   // task (authorization)
				results.hash,                                           // common    (result)
				results.seal,                                           // unique    (result)
				authorization.enclave,                                  // address   (enclave)
				results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
				authorization.sign,                                     // signature (authorization)
				{ from: authorization.worker, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
	}

	it("Initialization", async () => {
		tasks[0] = extractEvents(await IexecHubInstance.initialize(deals[0], 0, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // contributions
	});

	it("Contribute #1", async () => {
		await sendContribution(
			await odbtools.signAuthorization({ worker: poolWorker1, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, poolScheduler),
			odbtools.sealResult(tasks[0], "true", poolWorker1),
		);
		await sendContribution(
			await odbtools.signAuthorization({ worker: poolWorker2, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, poolScheduler),
			odbtools.sealResult(tasks[0], "false", poolWorker2),
		);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
	});

	it("Consensus #1", async () => {
		await IexecHubInstance.consensus(tasks[0], odbtools.hashResult(tasks[0], "true").hash, { from: poolScheduler });
	});

	it("clock fast forward", async () => {
		target = Number((await IexecHubInstance.viewTask(tasks[0])).revealDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("Reopen", async () => {
		await IexecHubInstance.reopen(tasks[0], { from: poolScheduler });
	});

	it("Contribute #2", async () => {
		try {
			await sendContribution(
				await odbtools.signAuthorization({ worker: poolWorker1, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, poolScheduler),
				odbtools.sealResult(tasks[0], "true", poolWorker1),
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("Returned error: VM Exception while processing transaction: revert"), "Expected an error starting with 'Returned error: VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		await sendContribution(
			await odbtools.signAuthorization({ worker: poolWorker3, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, poolScheduler),
			odbtools.sealResult(tasks[0], "true", poolWorker3),
		);
		await sendContribution(
			await odbtools.signAuthorization({ worker: poolWorker4, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, poolScheduler),
			odbtools.sealResult(tasks[0], "true", poolWorker4),
		);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
	});

	it("Consensus", async () => {
		await IexecHubInstance.consensus(tasks[0], odbtools.hashResult(tasks[0], "true").hash, { from: poolScheduler });
	});

	it("Reveal", async () => {
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: poolWorker3 });
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: poolWorker4 });
	});

	it("Finalize", async () => {
		await IexecHubInstance.finalize(tasks[0], web3.utils.utf8ToHex("aResult"), { from: poolScheduler });
	});

	it("[setup] Sanity check", async () => {
		// worker 1 & 2 lose their stake (8 each)
		// reward is 25 + 2 * 8 = 41
		// scheduler takes 5% → 2
		// remaining 39 are shared by worker 3 & 4 → 19 each
		// scheduler takes the 1 remaining
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  3,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 + 19, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 + 19, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 1, "score issue");
	});


});
