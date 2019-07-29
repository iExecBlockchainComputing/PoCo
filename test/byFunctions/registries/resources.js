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
const constants = require("../../../utils/constants");
const odbtools  = require('../../../utils/odb-tools');
const wallets   = require('../../../utils/wallets');

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
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
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
		RLCInstance                = await RLC.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecClerkInstance         = await IexecClerk.deployed();
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
			AppInstances[i] = await App.new(
				appProvider,
				"App #"+i,
				"DOCKER",
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of app #"+i),
				"0x1234",
				{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
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
			DatasetInstances[i] = await Dataset.new(
				datasetProvider,
				"Dataset #"+i,
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of dataset #"+i),
				{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
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
			WorkerpoolInstances[i] = await Workerpool.new(
				scheduler,
				"Workerpool #"+i,
				{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.equal( await WorkerpoolInstances[i].owner(),                        scheduler        );
			assert.equal( await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i );
			assert.equal( await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30               );
			assert.equal( await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                );
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
		assert.equal( events[0].args.oldWorkerStakeRatioPolicy,     30 );
		assert.equal( events[0].args.newWorkerStakeRatioPolicy,     35 );
		assert.equal( events[0].args.oldSchedulerRewardRatioPolicy, 1  );
		assert.equal( events[0].args.newSchedulerRewardRatioPolicy, 5  );

		assert.equal( await WorkerpoolInstances[1].owner(),                        scheduler       );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1" );
		assert.equal( await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35              );
		assert.equal( await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5               );
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

		assert.equal( await WorkerpoolInstances[1].owner(),                        scheduler       );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1" );
		assert.equal( await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35              );
		assert.equal( await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5               );
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

		assert.equal( await WorkerpoolInstances[1].owner(),                        scheduler       );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1" );
		assert.equal( await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35              );
		assert.equal( await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5               );
	});

});
