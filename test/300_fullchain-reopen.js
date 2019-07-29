var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../utils/constants");
const odbtools  = require('../utils/odb-tools');
const wallets   = require('../utils/wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('Fullchain', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let sgxEnclave      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let worker5         = accounts[8];
	let user            = accounts[9];

	var RLCInstance                = null;
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder         = null;
	var datasetorder     = null;
	var workerpoolorder1 = null;
	var workerpoolorder2 = null;
	var requestorder     = null;

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

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});
	});

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Deposit
		txsMined = await Promise.all([
			IexecClerkInstance.deposit({ from: scheduler, value: 1000}),
			IexecClerkInstance.deposit({ from: worker1,   value: 1000}),
			IexecClerkInstance.deposit({ from: worker2,   value: 1000}),
			IexecClerkInstance.deposit({ from: worker3,   value: 1000}),
			IexecClerkInstance.deposit({ from: worker4,   value: 1000}),
			IexecClerkInstance.deposit({ from: worker5,   value: 1000}),
			IexecClerkInstance.deposit({ from: user,      value: 1000}),
		]);

		// Ressources
		txMined = await AppRegistryInstance.createApp(
			appProvider,
			"R Clifford Attractors",
			"DOCKER",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			"0x",
			{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);

		txMined = await DatasetRegistryInstance.createDataset(
			datasetProvider,
			"Pi",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance = await Dataset.at(events[0].args.dataset);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);

		txMined = await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Orders
		apporder = odbtools.signAppOrder(
			{
				app:                AppInstance.address,
				appprice:           3,
				volume:             1000,
				tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
				datasetrestrict:    constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
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
				tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
				apprestrict:        constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(datasetProvider)
		);
		workerpoolorder = odbtools.signWorkerpoolOrder(
			{
				workerpool:        WorkerpoolInstance.address,
				workerpoolprice:   25,
				volume:            1,
				category:          4,
				trust:             4,
				tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
				apprestrict:       constants.NULL.ADDRESS,
				datasetrestrict:   constants.NULL.ADDRESS,
				requesterrestrict: constants.NULL.ADDRESS,
				salt:              web3.utils.randomHex(32),
				sign:              constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(scheduler)
		);
		requestorder = odbtools.signRequestOrder(
			{
				app:                AppInstance.address,
				appmaxprice:        3,
				dataset:            DatasetInstance.address,
				datasetmaxprice:    1,
				workerpool:         constants.NULL.ADDRESS,
				workerpoolmaxprice: 25,
				volume:             1,
				category:           4,
				trust:              4,
				tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
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
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker5)), 0, "score issue");
	});

	it("[setup] Match", async () => {
		// Market
		txMined = await IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.appHash,        odbtools.AppOrderTypedStructHash       (apporder       ));
		assert.equal(events[0].args.datasetHash,    odbtools.DatasetOrderTypedStructHash   (datasetorder   ));
		assert.equal(events[0].args.workerpoolHash, odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder));
		assert.equal(events[0].args.requestHash,    odbtools.RequestOrderTypedStructHash   (requestorder   ));
		assert.equal(events[0].args.volume,         1                                                  );

		// Deals
		deals = await IexecClerkInstance.viewRequestDeals(odbtools.RequestOrderTypedStructHash(requestorder));
		assert.equal(deals[0], events[0].args.dealid);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7, 0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29, 0 + 29 ], "check balance");
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
		tasks[0] = extractEvents(await IexecHubInstance.initialize(deals[0], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // contributions
	});

	it("Contribute #1", async () => {
		await sendContribution(
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[0], enclave: sgxEnclave }, scheduler),
			await odbtools.signContribution(odbtools.sealResult(tasks[0], "true", worker1), sgxEnclave),
		);
		await sendContribution(
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[0], enclave: sgxEnclave }, scheduler),
			await odbtools.signContribution(odbtools.sealResult(tasks[0], "true", worker2), sgxEnclave),
		);
	});

	it("[setup] Sanity check", async () => {
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7, 0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29, 0 + 29 ], "check balance");
	});
	it("clock fast forward", async () => {
		target = Number((await IexecHubInstance.viewTask(tasks[0])).revealDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("Reopen", async () => {
		await IexecHubInstance.reopen(tasks[0], { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
	});

	it("Contribute #2", async () => {
		await expectRevert.unspecified(sendContribution(
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[0], enclave: constants.NULL.ADDRESS }, scheduler),
			odbtools.sealResult(tasks[0], "true", worker1)
		));

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
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,      0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  7, 0 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000     , 0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29, 0 + 29 ], "check balance");
	});

	it("Reveal", async () => {
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: worker3, gas: constants.AMOUNT_GAS_PROVIDED });
		await IexecHubInstance.reveal(tasks[0], odbtools.hashResult(tasks[0], "true").digest, { from: worker4, gas: constants.AMOUNT_GAS_PROVIDED });
	});

	it("Finalize", async () => {
		await IexecHubInstance.finalize(tasks[0], web3.utils.utf8ToHex("aResult"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
	});

	it("[setup] Sanity check", async () => {
		// worker 1 & 2 lose their stake (8 each)
		// reward is 25 + 2 * 8 = 41
		// scheduler takes 5% → 2
		// remaining 39 are shared by worker 3 & 4 → 19 each
		// scheduler takes the 1 remaining
		balance = await IexecClerkInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  3, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 -  8, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 + 19, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 + 19, 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000     , 0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 29, 0 ], "check balance");
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker5)), 0, "score issue");
	});

});
