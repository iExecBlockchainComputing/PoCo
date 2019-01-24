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
var SMSDirectory       = artifacts.require("./SMSDirectory.sol");

const { shouldFail } = require('openzeppelin-test-helpers');
const   multiaddr    = require('multiaddr');
const   constants    = require("../../constants");
const   odbtools     = require('../../../utils/odb-tools');
const   wallets      = require('../../wallets');

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
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.MULTIADDR_BYTES, "0x", { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);

		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", constants.MULTIADDR_BYTES, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
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
		workerpoolorder_offset = odbtools.signWorkerpoolOrder(
			{
				workerpool:        WorkerpoolInstance.address,
				workerpoolprice:   15,
				volume:            1,
				tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
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
				tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
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
				tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
				category:           4,
				trust:              4,
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
		tasks[1] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 1 });                                                                // uninitialized
		tasks[2] = extractEvents(await IexecHubInstance.initialize(deals[1], 2, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // initialized
		tasks[3] = extractEvents(await IexecHubInstance.initialize(deals[1], 3, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // contributions
		tasks[4] = extractEvents(await IexecHubInstance.initialize(deals[1], 4, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // consensus
		tasks[5] = extractEvents(await IexecHubInstance.initialize(deals[1], 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // reveal
		tasks[6] = extractEvents(await IexecHubInstance.initialize(deals[1], 6, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid; // finalized
	});66

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
			tasks[3],
			worker1,
			odbtools.sealResult(tasks[3], "true", worker1),
			await odbtools.signAuthorization({ worker: worker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[4],
			worker1,
			odbtools.sealResult(tasks[4], "true", worker1),
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
			odbtools.sealResult(tasks[6], "true", worker2),
			await odbtools.signAuthorization({ worker: worker2, taskid: tasks[6], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
	});

	it("[setup] Reveal", async () => {
		await IexecHubInstance.reveal(tasks[5], odbtools.hashResult(tasks[5], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		await IexecHubInstance.reveal(tasks[6], odbtools.hashResult(tasks[6], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		await IexecHubInstance.reveal(tasks[6], odbtools.hashResult(tasks[6], "true").digest, { from: worker2, gas: constants.AMOUNT_GAS_PROVIDED });
	});
	it("[setup] Finalize", async () => {
		await IexecHubInstance.finalize(tasks[6], web3.utils.utf8ToHex("aResult 6"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
	});


	it("[7.1a] Claim - Error (soon #1)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[1], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.2a] Claim - Error (soon #2)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[2], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.3a] Claim - Error (soon #3)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[3], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.4a] Claim - Error (soon #4)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[4], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.5a] Claim - Error (soon #5)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[5], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.6a] Claim - Error (soon & finalized)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[6], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});

	it("clock fast forward", async () => {
		target = Number((await IexecHubInstance.viewTask(tasks[2])).finalDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[7.1b] Claim - Correct (#1)", async () => {
		// needs late Initialization by the user
		await IexecHubInstance.initialize(deals[1], 1, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		txMined = await IexecHubInstance.claim(tasks[1], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[1], "check taskid");
	});
	it("[7.2b] Claim - Correct (#2)", async () => {
		txMined = await IexecHubInstance.claim(tasks[2], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[2], "check taskid");
	});
	it("[7.3b] Claim - Correct (#3)", async () => {
		txMined = await IexecHubInstance.claim(tasks[3], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[3], "check taskid");
	});
	it("[7.4b] Claim - Correct (#4)", async () => {
		txMined = await IexecHubInstance.claim(tasks[4], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[4], "check taskid");
	});
	it("[7.5b] Claim - Correct (#5)", async () => {
		txMined = await IexecHubInstance.claim(tasks[5], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[5], "check taskid");
	});
	it("[7.6b] Claim - Error (finalized #7)", async () => {
		await shouldFail.reverting(IexecHubInstance.claim(tasks[6], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});

});
