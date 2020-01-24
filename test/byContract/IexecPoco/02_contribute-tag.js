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
				tag:               "0x0000000000000000000000000000000000000000000000000000000000000001",
				category:          4,
				trust:             10,
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
				tag:               "0x0000000000000000000000000000000000000000000000000000000000000001",
				category:          4,
				trust:             10,
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
				tag:                "0x0000000000000000000000000000000000000000000000000000000000000001",
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
		tasks[1] = tools.extractEvents(await IexecInstance.initialize(deals[1], 1, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[2] = tools.extractEvents(await IexecInstance.initialize(deals[1], 2, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[3] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 3 });
		tasks[4] = tools.extractEvents(await IexecInstance.initialize(deals[1], 4, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[5] = tools.extractEvents(await IexecInstance.initialize(deals[1], 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[6] = tools.extractEvents(await IexecInstance.initialize(deals[1], 6, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[7] = tools.extractEvents(await IexecInstance.initialize(deals[1], 7, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
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

	it("[2.1][TAG] Contribute - Error (missing sgx)", async () => {
		__taskid  = tasks[1];
		__worker  = worker1;
		__enclave = { address: constants.NULL.ADDRESS };
		__raw     = "true";

		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			odbtools.utils.sealResult(__taskid, __raw, __worker),
			await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentScheduler.wallet),
			__enclave.address
		));
	});

	it("[2.2][TAG] Contribute - Correct (sgx)", async () => {
		__taskid  = tasks[2];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		txMined = await sendContribution(
			__taskid,
			__worker,
			(await odbtools.utils.signContribution (odbtools.utils.sealResult(__taskid, __raw, __worker),               __enclave)),
			(await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentBroker.wallet)),
			__enclave.address
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, IexecInstance.address, "TaskContribute");
		assert.equal(events[0].args.taskid, __taskid,                                        "check taskid"    );
		assert.equal(events[0].args.worker, __worker,                                        "check worker"    );
		assert.equal(events[0].args.hash,   odbtools.utils.hashResult(__taskid, __raw).hash, "check resultHash");
	});

	it("[2.3][TAG] Contribute - Error (unset)", async () => {
		__taskid  = tasks[3];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			await odbtools.utils.signContribution (odbtools.utils.sealResult(__taskid, __raw, __worker),               __enclave),
			await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentBroker.wallet),
			__enclave.address
		));
	});

	it("[2.4][TAG] Contribute - Error (duplicate)", async () => {
		__taskid  = tasks[4];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		results       = (await odbtools.utils.signContribution (odbtools.utils.sealResult(__taskid, __raw, __worker),               __enclave)),
		authorization = (await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentBroker.wallet));
		// First ok
		await sendContribution(
			__taskid,
			__worker,
			results,
			authorization,
			__enclave.address
		);
		// Second error
		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			results,
			authorization,
			__enclave.address
		));
	});

	it("[2.5][TAG] Contribute - Error (authorization)", async () => {
		__taskid  = tasks[5];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			await odbtools.utils.signContribution (odbtools.utils.sealResult(__taskid, __raw, __worker),               __enclave),
			await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentScheduler.wallet), // signature: teebroker → scheduler
			__enclave.address
		));
	});

	it("[2.6][TAG] Contribute - Error (enclave signature)", async () => {
		__taskid  = tasks[6];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			odbtools.utils.sealResult(__taskid, __raw, __worker), // should be signed
			await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentBroker.wallet),
			__enclave.address
		));
	});

	it("clock fast forward", async () => {
		target = Number((await IexecInstance.viewTask(tasks[7])).finalDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[2.7][TAG] Contribute - Late", async () => {
		__taskid  = tasks[7];
		__worker  = worker1;
		__enclave = web3.eth.accounts.create();
		__raw     = "true"

		await expectRevert.unspecified(sendContribution(
			__taskid,
			__worker,
			await odbtools.utils.signContribution (odbtools.utils.sealResult(__taskid, __raw, __worker),               __enclave),
			await odbtools.utils.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave.address }, agentBroker.wallet), // signature: scheduler → worker
			__enclave.address
		));
	});

});
