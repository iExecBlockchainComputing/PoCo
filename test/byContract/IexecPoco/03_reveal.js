// Config
var DEPLOYMENT = require("../../../config/deployment.json")
// Artefacts
var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../../../utils/constants");
const odbtools  = require('../../../utils/odb-tools');
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('Poco', async (accounts) => {

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
	var IexecInstance              = null;
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
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecInstance.address,
		});
	});

	/***************************************************************************
	 *                             TEST: deposit                              *
	 ***************************************************************************/
	it("[Setup] deposit", async () => {
		switch (DEPLOYMENT.asset)
		{
			case "Native":
				await IexecInstance.deposit({ from: iexecAdmin, value: 10000000, gas: constants.AMOUNT_GAS_PROVIDED });
				break;

			case "Token":
				await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				break;
		}
		await Promise.all([
			IexecInstance.transfer(scheduler, 1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker1,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker2,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker3,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker4,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker5,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(user,      1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
		]);
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
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
			IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder_offset, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder,        requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		deals = await odbtools.requestToDeal(IexecInstance, odbtools.RequestOrderTypedStructHash(requestorder));
	});

	it("[setup] Initialization", async () => {
		tasks[1] = extractEvents(await IexecInstance.initialize(deals[1], 1, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // good
		tasks[2] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 2 });                                                                // uninitialized
		tasks[3] = extractEvents(await IexecInstance.initialize(deals[1], 3, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // no consensus
		tasks[4] = extractEvents(await IexecInstance.initialize(deals[1], 4, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // bad contrib
		tasks[5] = extractEvents(await IexecInstance.initialize(deals[1], 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // bad hash
		tasks[6] = extractEvents(await IexecInstance.initialize(deals[1], 6, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // bad seal
		tasks[7] = extractEvents(await IexecInstance.initialize(deals[1], 7, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // late
	});

	function sendContribution(taskid, worker, results, authorization, enclave)
	{
		return IexecInstance.contribute(
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
		txMined = await IexecInstance.reveal(
			tasks[1],
			odbtools.hashResult(tasks[1], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecInstance.address, "TaskReveal");
		assert.equal(events[0].args.taskid, tasks[1],                                     "check taskid");
		assert.equal(events[0].args.worker, worker1,                                      "check worker");
		assert.equal(events[0].args.digest, odbtools.hashResult(tasks[1], "true").digest, "check result");
	});

	it("[4.2] Reveal - Error (unset)", async () => {
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[2],
			odbtools.hashResult(tasks[2], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("[4.3] Reveal - Error (no consensus)", async () => {
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[3],
			odbtools.hashResult(tasks[3], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("[4.4] Reveal - Error (contribution value)", async () => {
		await IexecInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker2, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await IexecInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker3, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await IexecInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker4, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[4],
			odbtools.hashResult(tasks[4], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("[4.6] Reveal - Error .hash)", async () => {
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[5],
			odbtools.hashResult(tasks[5], "nottrue").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("[4.6] Reveal - Error .seal)", async () => {
		await IexecInstance.reveal(
			tasks[6],
			odbtools.hashResult(tasks[6], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[6],
			odbtools.hashResult(tasks[6], "true").digest,
			{ from: worker2, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("clock fast forward", async () => {
		target = Number((await IexecInstance.viewTask(tasks[7])).revealDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[4.7] Reveal - Error (late for reveal)", async () => {
		await expectRevert.unspecified(IexecInstance.reveal(
			tasks[7],
			odbtools.hashResult(tasks[7], "true").digest,
			{ from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});
});
