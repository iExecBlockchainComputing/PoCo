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

contract('Ressources', async (accounts) => {

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

	var AppInstances = {};
	var DatasetInstances = {};
	var WorkerpoolInstances = {};

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
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("App Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await AppRegistryInstance.createApp(
				appProvider,
				"App #"+i,
				"DOCKER",
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of app #"+i),
				"0x1234",
				{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);

			AppInstances[i] = await App.at(extractEvents(txMined, AppRegistryInstance.address, "CreateApp")[0].args.app);

			assert.equal(await AppInstances[i].registry(),       AppRegistryInstance.address               );
			assert.equal(await AppInstances[i].owner(),          appProvider                               );
			assert.equal(await AppInstances[i].m_appName(),      "App #"+i                                 );
			assert.equal(await AppInstances[i].m_appType(),      "DOCKER"                                  );
			assert.equal(await AppInstances[i].m_appMultiaddr(), constants.MULTIADDR_BYTES                 );
			assert.equal(await AppInstances[i].m_appChecksum(),  web3.utils.keccak256("Content of app #"+i));
			assert.equal(await AppInstances[i].m_appMREnclave(), "0x1234"                                  );
		}
	});

	/***************************************************************************
	 *                  TEST: Dataset creation (by datasetProvider)                  *
	 ***************************************************************************/
	it("Dataset Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await DatasetRegistryInstance.createDataset(
				datasetProvider,
				"Dataset #"+i,
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of dataset #"+i),
				{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);

			DatasetInstances[i] = await Dataset.at(extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset")[0].args.dataset);

			assert.equal(await DatasetInstances[i].registry(),           DatasetRegistryInstance.address               );
			assert.equal(await DatasetInstances[i].owner(),              datasetProvider                               );
			assert.equal(await DatasetInstances[i].m_datasetName(),      "Dataset #"+i                                 );
			assert.equal(await DatasetInstances[i].m_datasetMultiaddr(), constants.MULTIADDR_BYTES                     );
			assert.equal(await DatasetInstances[i].m_datasetChecksum(),  web3.utils.keccak256("Content of dataset #"+i));
		}
	});

	/***************************************************************************
	 *                 TEST: Workerpool creation (by scheduler)                  *
	 ***************************************************************************/
	it("Workerpool Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await WorkerpoolRegistryInstance.createWorkerpool(
				scheduler,
				"Workerpool #"+i,
				{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
			);

			WorkerpoolInstances[i] = await Workerpool.at(extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool")[0].args.workerpool);

			assert.equal(await WorkerpoolInstances[i].registry(),                     WorkerpoolRegistryInstance.address);
			assert.equal(await WorkerpoolInstances[i].owner(),                        scheduler                         );
			assert.equal(await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i                  );
			assert.equal(await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30                                );
			assert.equal(await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                                 );
		}
	});

	/***************************************************************************
	 *               TEST: Workerpool configuration (by scheduler)               *
	 ***************************************************************************/
	it("Workerpool Configuration - owner can configure", async () => {
		txMined = await WorkerpoolInstances[1].changePolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, WorkerpoolInstances[1].address, "PolicyUpdate");
		assert.equal(events[0].args.oldWorkerStakeRatioPolicy,     30 );
		assert.equal(events[0].args.newWorkerStakeRatioPolicy,     35 );
		assert.equal(events[0].args.oldSchedulerRewardRatioPolicy, 1  );
		assert.equal(events[0].args.newSchedulerRewardRatioPolicy, 5  );

		assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler      );
		assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1");
		assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35             );
		assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5              );
	});

	/***************************************************************************
	 *                   TEST: Workerpool configuration (by user)                    *
	 ***************************************************************************/
	it("Workerpool Configuration #2 - owner restriction apply", async () => {
		await expectRevert.unspecified(WorkerpoolInstances[1].changePolicy(
			0,
			0,
			{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
		));

		assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler      );
		assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1");
		assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35             );
		assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5              );
	});

	/***************************************************************************
	 *           TEST: Invalid workerpool configuration (by scheduler)           *
	 ***************************************************************************/
	it("Workerpool Configuration #3 - invalid configuration refused", async () => {
		await expectRevert.unspecified(WorkerpoolInstances[1].changePolicy(
			100, // worker stake ratio
			150, // scheduler reward ratio (should not be above 100%)
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		));

		assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler      );
		assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1");
		assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35             );
		assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5              );
	});
});
