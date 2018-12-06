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

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

const wallets   = require('../../wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

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
	var RelayInstance              = null;
	var BrokerInstance             = null;

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
			RLCInstance.transfer(worker5,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
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
		assert.isBelow(txsMined[8].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(appProvider),
			RLCInstance.balanceOf(datasetProvider),
			RLCInstance.balanceOf(scheduler),
			RLCInstance.balanceOf(worker1),
			RLCInstance.balanceOf(worker2),
			RLCInstance.balanceOf(worker3),
			RLCInstance.balanceOf(worker4),
			RLCInstance.balanceOf(worker5),
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
		assert.equal(balances[8], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker1,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker2,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker3,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker4,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker5,         gas: constants.AMOUNT_GAS_PROVIDED }),
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
		assert.isBelow(txsMined[8].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		txsMined = await Promise.all([
			IexecClerkInstance.deposit(100000, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: worker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: worker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: worker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: worker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: worker5,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(100000, { from: user,      gas: constants.AMOUNT_GAS_PROVIDED }),
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
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);

		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance = await Dataset.at(events[0].args.dataset);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A test workerpool", { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
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
				tag:                0x0,
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
				tag:                0x0,
				apprestrict:        constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(datasetProvider)
		);
		workerpoolorder_offset = odbtools.signWorkerpoolOrder(
			{
				workerpool:        WorkerpoolInstance.address,
				workerpoolprice:   15,
				volume:            1,
				tag:               0x0,
				category:          4,
				trust:             4,
				apprestrict:       constants.NULL.ADDRESS,
				datasetrestrict:   constants.NULL.ADDRESS,
				requesterrestrict: constants.NULL.ADDRESS,
				salt:              web3.utils.randomHex(32),
				sign:              constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(scheduler)
		);
		workerpoolorder = odbtools.signWorkerpoolOrder(
			{
				workerpool:        WorkerpoolInstance.address,
				workerpoolprice:   25,
				volume:            1000,
				tag:               0x0,
				category:          4,
				trust:             4,
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
				volume:             10,
				tag:                0x0,
				category:           4,
				trust:              0,
				requester:          user,
				beneficiary:        user,
				callback:           constants.NULL.ADDRESS,
				params:             "<parameters>",
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);

		// Market
		txsMined = await Promise.all([
			IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder_offset, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder,        requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		deals = await IexecClerkInstance.viewRequestDeals(odbtools.RequestOrderStructHash(requestorder));
	});

	it("[setup] Initialization", async () => {
		tasks[1] = extractEvents(await IexecHubInstance.initialize(deals[1], 1, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // good
		tasks[2] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 2 });                                                                // uninitialized
		tasks[3] = extractEvents(await IexecHubInstance.initialize(deals[1], 3, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // no consensus
		tasks[4] = extractEvents(await IexecHubInstance.initialize(deals[1], 4, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // bad contrib
		tasks[5] = extractEvents(await IexecHubInstance.initialize(deals[1], 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // bad hash
		tasks[6] = extractEvents(await IexecHubInstance.initialize(deals[1], 6, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // bad seal
		tasks[7] = extractEvents(await IexecHubInstance.initialize(deals[1], 7, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // late
	});

	function sendContribution(taskid, worker, results, authorization, enclave)
	{
		return IexecHubInstance.contribute(
				taskid,                                                 // task (authorization)
				results.hash,                                           // common    (result)
				results.seal,                                           // unique    (result)
				enclave,                                                // address   (enclave)
				results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
				authorization.sign,                                     // signature (authorization)
				{ from: worker, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
	}

	it("[setup] Contribute", async () => {
		await sendContribution(
			tasks[1],
			worker1,
			odbtools.sealResult(tasks[1], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[1],
			worker2,
			odbtools.sealResult(tasks[1], "true", worker2),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[3],
			worker1,
			odbtools.sealResult(tasks[3], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[4],
			worker1,
			odbtools.sealResult(tasks[4], "false", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[4],
			worker2,
			odbtools.sealResult(tasks[4], "true", worker2),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[4],
			worker3,
			odbtools.sealResult(tasks[4], "true", worker3),
			await odbtools.signAuthorization({ worker: worker3, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[4],
			worker4,
			odbtools.sealResult(tasks[4], "true", worker4),
			await odbtools.signAuthorization({ worker: worker4, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[4],
			worker5,
			odbtools.sealResult(tasks[4], "true", worker5),
			await odbtools.signAuthorization({ worker: worker5, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[5],
			worker1,
			odbtools.sealResult(tasks[5], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[5], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[5],
			worker2,
			odbtools.sealResult(tasks[5], "true", worker2),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[5], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[6],
			worker1,
			odbtools.sealResult(tasks[6], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[6], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[6],
			worker2,
			odbtools.sealResult(tasks[6], "true", worker1),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[6], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[7],
			worker1,
			odbtools.sealResult(tasks[7], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[7], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[7],
			worker2,
			odbtools.sealResult(tasks[7], "true", worker2),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[7], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
	});

	it("[4.1] Reveal - Correct", async () => {
		txMined = await IexecHubInstance.reveal(
			tasks[1],
			odbtools.hashResult(tasks[1], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskReveal");
		assert.equal(events[0].args.taskid, tasks[1],                                     "check taskid");
		assert.equal(events[0].args.worker, worker1,                                      "check worker");
		assert.equal(events[0].args.digest, odbtools.hashResult(tasks[1], "true").digest, "check result");
	});

	it("[4.2] Reveal - Error (unset)", async () => {
		try {
			await IexecHubInstance.reveal(
				tasks[2],
				odbtools.hashResult(tasks[2], "true").digest,
				{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[4.3] Reveal - Error (no consensus)", async () => {
		try {
			await IexecHubInstance.reveal(
				tasks[3],
				odbtools.hashResult(tasks[3], "true").digest,
				{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[4.4] Reveal - Error (contribution value)", async () => {
		await IexecHubInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker2, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await IexecHubInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker3, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await IexecHubInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker4, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		try {
			await IexecHubInstance.reveal(
				tasks[4],
				odbtools.hashResult(tasks[4], "true").digest,
				{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[4.6] Reveal - Error .hash)", async () => {
		try {
			await IexecHubInstance.reveal(
				tasks[5],
				odbtools.hashResult(tasks[5], "nottrue").digest,
				{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[4.6] Reveal - Error .seal)", async () => {
		await IexecHubInstance.reveal(
			tasks[6],
			odbtools.hashResult(tasks[6], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		try {
			await IexecHubInstance.reveal(
				tasks[6],
				odbtools.hashResult(tasks[6], "true").digest,
				{ from: worker2, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("clock fast forward", async () => {
		target = Number((await IexecHubInstance.viewTask(tasks[7])).revealDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[4.7] Reveal - Error (late for reveal)", async () => {
		try {
			await IexecHubInstance.reveal(
				tasks[7],
				odbtools.hashResult(tasks[7], "true").digest,
				{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
});
