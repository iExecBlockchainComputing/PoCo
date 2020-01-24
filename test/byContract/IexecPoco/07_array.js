// Config
var DEPLOYMENT         = require("../../../config/config.json").chains.default;
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

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const multiaddr = require('multiaddr');
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Poco', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();

		agentBroker    = new odbtools.MockBroker(IexecInstance);
		agentScheduler = new odbtools.MockScheduler(scheduler);
		await agentBroker.initialize();
	});

	/***************************************************************************
	 *                             TEST: deposit                              *
	 ***************************************************************************/
	it("[Setup] deposit", async () => {
		switch (DEPLOYMENT.asset)
		{
			case "Native":
				await IexecInstance.deposit({ from: iexecAdmin, value: 10000000 * 10 ** 9, gas: constants.AMOUNT_GAS_PROVIDED });
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
		events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
		AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));

		txMined = await DatasetRegistryInstance.createDataset(
			datasetProvider,
			"Pi",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
		DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
		WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));

		txMined = await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Orders
		apporder = odbtools.signAppOrder(
			ERC712_domain,
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
			ERC712_domain,
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
			ERC712_domain,
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
			ERC712_domain,
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
			ERC712_domain,
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

		deals = await odbtools.utils.requestToDeal(IexecInstance, odbtools.hashRequestOrder(ERC712_domain, requestorder));
	});

	it("[setup] Initialization", async () => {
		txMined = await IexecInstance.initializeArray(
			[ /*deals[1],*/ deals[1], deals[1], deals[1], deals[1], deals[1], ],
			[ /*1,       */ 2,        3,        4,        5,        6,        ],
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);

		tasks[1] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 1 });    // uninitialized
		tasks[2] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[0].args.taskid; // initialized
		tasks[3] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[1].args.taskid; // contributions
		tasks[4] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[2].args.taskid; // consensus
		tasks[5] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[3].args.taskid; // reveal
		tasks[6] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[4].args.taskid; // finalized
		tasks[7] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 7 });    // uninitialized
		tasks[8] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 8 });    // uninitialized
		tasks[9] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 9 });    // uninitialized
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
			tasks[3],
			worker1,
			odbtools.utils.sealResult(tasks[3], "true", worker1),
			await odbtools.utils.signAuthorization({ worker: worker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[4],
			worker1,
			odbtools.utils.sealResult(tasks[4], "true", worker1),
			await odbtools.utils.signAuthorization({ worker: worker1, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[4],
			worker2,
			odbtools.utils.sealResult(tasks[4], "true", worker2),
			await odbtools.utils.signAuthorization({ worker: worker2, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[5],
			worker1,
			odbtools.utils.sealResult(tasks[5], "true", worker1),
			await odbtools.utils.signAuthorization({ worker: worker1, taskid: tasks[5], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[5],
			worker2,
			odbtools.utils.sealResult(tasks[5], "true", worker2),
			await odbtools.utils.signAuthorization({ worker: worker2, taskid: tasks[5], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);

		await sendContribution(
			tasks[6],
			worker1,
			odbtools.utils.sealResult(tasks[6], "true", worker1),
			await odbtools.utils.signAuthorization({ worker: worker1, taskid: tasks[6], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[6],
			worker2,
			odbtools.utils.sealResult(tasks[6], "true", worker2),
			await odbtools.utils.signAuthorization({ worker: worker2, taskid: tasks[6], enclave: constants.NULL.ADDRESS }, scheduler),
			constants.NULL.ADDRESS
		);
	});

	it("[setup] Reveal", async () => {
		await IexecInstance.reveal(tasks[5], odbtools.utils.hashResult(tasks[5], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		await IexecInstance.reveal(tasks[6], odbtools.utils.hashResult(tasks[6], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		await IexecInstance.reveal(tasks[6], odbtools.utils.hashResult(tasks[6], "true").digest, { from: worker2, gas: constants.AMOUNT_GAS_PROVIDED });
	});
	it("[setup] Finalize", async () => {
		await IexecInstance.finalize(tasks[6], web3.utils.utf8ToHex("aResult 6"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
	});


	it("[7.1a] Claim - Error (soon #1)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[1], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.2a] Claim - Error (soon #2)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[2], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.3a] Claim - Error (soon #3)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[3], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.4a] Claim - Error (soon #4)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[4], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.5a] Claim - Error (soon #5)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[5], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.6a] Claim - Error (soon & finalized)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[6], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});
	it("[7.7a] Claim - Error (soon #6)", async () => {
		await expectRevert.unspecified(IexecInstance.initializeAndClaimArray(
			[ deals[1], deals[1], deals[1] ],
			[        7,        8,        9 ],
			{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
		));
	});

	it("clock fast forward", async () => {
		target = Number((await IexecInstance.viewTask(tasks[2])).finalDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[7.1b] Claim - Correct", async () => {
		// needs late Initialization by the user
		await IexecInstance.initializeArray(
			[ deals[1] ],
			[        1 ],
			{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		// claim
		txMined = await IexecInstance.claimArray(
			[ tasks[1], tasks[2], tasks[3], tasks[4], tasks[5] ],
			{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, IexecInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[1], "check taskid");
		assert.equal(events[1].args.taskid, tasks[2], "check taskid");
		assert.equal(events[2].args.taskid, tasks[3], "check taskid");
		assert.equal(events[3].args.taskid, tasks[4], "check taskid");
		assert.equal(events[4].args.taskid, tasks[5], "check taskid");
	});

	it("[7.6b] Claim - Error (finalized #7)", async () => {
		await expectRevert.unspecified(IexecInstance.claim(tasks[6], { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
	});

	it("[7.7a] Claim - Correct", async () => {
		txMined = await IexecInstance.initializeAndClaimArray(
			[ deals[1], deals[1], deals[1] ],
			[        7,        8,        9 ],
			{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, IexecInstance.address, "TaskClaimed");
		assert.equal(events[0].args.taskid, tasks[7], "check taskid");
		assert.equal(events[1].args.taskid, tasks[8], "check taskid");
		assert.equal(events[2].args.taskid, tasks[9], "check taskid");
	});
});
