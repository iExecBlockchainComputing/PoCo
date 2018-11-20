var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");
var Relay              = artifacts.require("./Relay.sol");
var Broker             = artifacts.require("./Broker.sol");

const constants = require("./constants");
const odbtools  = require('../utils/odb-tools');

const wallets   = require('./wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let user            = accounts[8];
	let sgxEnclave      = accounts[9];

	var RLCInstance                = null;
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;
	var RelayInstance              = null;
	var BrokerInstance             = null;

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder         = null;
	var datasetorder     = null;
	var workerpoolorder1 = null;
	var workerpoolorder2 = null;
	var userorder        = null;

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
		RLCInstance                = await RLC.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecClerkInstance         = await IexecClerk.deployed();
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		RelayInstance              = await Relay.deployed();
		BrokerInstance             = await Broker.deployed();

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
			RLCInstance.transfer(appProvider,     1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(datasetProvider, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(scheduler,       1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker1,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker2,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker3,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker4,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,            1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
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
			RLCInstance.balanceOf(appProvider),
			RLCInstance.balanceOf(datasetProvider),
			RLCInstance.balanceOf(scheduler),
			RLCInstance.balanceOf(worker1),
			RLCInstance.balanceOf(worker2),
			RLCInstance.balanceOf(worker3),
			RLCInstance.balanceOf(worker4),
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
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker1,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker2,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker3,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker4,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,            gas: constants.AMOUNT_GAS_PROVIDED })
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
			IexecClerkInstance.deposit(1000, { from: scheduler }),
			IexecClerkInstance.deposit(1000, { from: worker1   }),
			IexecClerkInstance.deposit(1000, { from: worker2   }),
			IexecClerkInstance.deposit(1000, { from: worker3   }),
			IexecClerkInstance.deposit(1000, { from: worker4   }),
			IexecClerkInstance.deposit(1000, { from: user      }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance        = await App.at(events[0].args.app);

		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance    = await Dataset.at(events[0].args.dataset);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A test workerpool", /* lock*/ 10, /* minimum stake*/ 10, /* minimum score*/ 10, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);

		txMined = await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, /* minimum stake */ 100, /* minimum score */ 0, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Workers
		txsMined = await Promise.all([
			IexecHubInstance.subscribe(WorkerpoolInstance.address, { from: worker1 }),
			IexecHubInstance.subscribe(WorkerpoolInstance.address, { from: worker2 }),
			IexecHubInstance.subscribe(WorkerpoolInstance.address, { from: worker3 }),
			IexecHubInstance.subscribe(WorkerpoolInstance.address, { from: worker4 }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Orders
		apporder = odbtools.signAppOrder(
			{
				app:                AppInstance.address,
				appprice:           3,
				volume:             1000,
				tag:                0x0,
				datasetrestrict:    constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				userrestrict:       constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(appProvider)
		);
		datasetorder = odbtools.signDatasetOrder(
			{
				dataset:            DatasetInstance.address,
				datasetprice:       1,
				volume:             1000,
				tag:                0x0,
				apprestrict:        constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				userrestrict:       constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(datasetProvider)
		);
		workerpoolorder = odbtools.signWorkerpoolOrder(
			{
				workerpool:      WorkerpoolInstance.address,
				workerpoolprice: 25,
				volume:          1,
				category:        4,
				trust:           10,
				tag:             0x0,
				apprestrict:     constants.NULL.ADDRESS,
				datasetrestrict: constants.NULL.ADDRESS,
				userrestrict:    constants.NULL.ADDRESS,
				salt:            web3.utils.randomHex(32),
				sign:            constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(scheduler)
		);
		userorder = odbtools.signUserOrder(
			{
				app:                AppInstance.address,
				appmaxprice:        3,
				dataset:            DatasetInstance.address,
				datasetmaxprice:    1,
				workerpool:         constants.NULL.ADDRESS,
				workerpoolmaxprice: 25,
				volume:             1,
				category:           4,
				trust:              10,
				tag:                0x0,
				requester:          user,
				beneficiary:        user,
				callback:           constants.NULL.ADDRESS,
				params:             "<parameters>",
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,   0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,  10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,   0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
	});

	it("[setup] Match", async () => {
		// Market
		txMined = await IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder, userorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.appHash,        odbtools.AppOrderStructHash       (apporder       ));
		assert.equal(events[0].args.datasetHash,    odbtools.DatasetOrderStructHash   (datasetorder      ));
		assert.equal(events[0].args.workerpoolHash, odbtools.WorkerpoolOrderStructHash(workerpoolorder));
		assert.equal(events[0].args.userHash,       odbtools.UserOrderStructHash      (userorder      ));
		assert.equal(events[0].args.volume,         1                                                  );

		// Deals
		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(userorder));
		assert.equal(deals[0], events[0].args.dealid);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
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
		tasks[0] = extractEvents(await IexecHubInstance.initialize(deals[0], 0, { from: scheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // contributions
	});

	it("Contribute #1", async () => {
		await sendContribution(
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[0], enclave: sgxEnclave }, scheduler),
			await odbtools.signContribution(odbtools.sealResult(tasks[0], "true", worker1), sgxEnclave),
		);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990,      10      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
	});
	it("clock fast forward", async () => {
		target = Number((await IexecHubInstance.viewTask(tasks[0])).revealDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("Reopen", async () => {
		await IexecHubInstance.reopen(tasks[0], { from: scheduler });
	});

	it("Contribute #2", async () => {
		try {
			await sendContribution(
				await odbtools.signAuthorization({ worker: worker1, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, scheduler),
				odbtools.sealResult(tasks[0], "true", worker1),
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		await sendContribution(
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, scheduler),
			odbtools.sealResult(tasks[0], "false", worker2),
		);
		await sendContribution(
			await odbtools.signAuthorization({ worker: worker3, taskid: tasks[0], enclave: sgxEnclave }, scheduler),
			await odbtools.signContribution(odbtools.sealResult(tasks[0], "true", worker3), sgxEnclave),
		);
		await sendContribution(
			await odbtools.signAuthorization({ worker: worker4, taskid: tasks[0], enclave: sgxEnclave }, scheduler),
			await odbtools.signContribution(odbtools.sealResult(tasks[0], "true", worker4), sgxEnclave),
		);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,       0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7,  0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 + 29 ], "check balance");
	});

	it("Reveal", async () => {
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: worker3 });
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: worker4 });
	});

	it("Finalize", async () => {
		await IexecHubInstance.finalize(tasks[0], web3.utils.utf8ToHex("aResult"), { from: scheduler });
	});

	it("[setup] Sanity check", async () => {
		// worker 1 & 2 lose their stake (8 each)
		// reward is 25 + 2 * 8 = 41
		// scheduler takes 5% → 2
		// remaining 39 are shared by worker 3 & 4 → 19 each
		// scheduler takes the 1 remaining
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  3,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 -  8, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 + 19, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990 + 19, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29,  0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 1, "score issue");
	});

});
