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
		RelayInstance              = await Relay.deployed();
		BrokerInstance             = await Broker.deployed();
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
				constants.DAPP_PARAMS_EXAMPLE,
				constants.NULL.BYTES32,
				{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.equal ( await AppInstances[i].m_owner(),     appProvider,                   "Erroneous App owner" );
			assert.equal ( await AppInstances[i].m_appName(),   "App #"+i,                     "Erroneous App name"  );
			assert.equal ( await AppInstances[i].m_appParams(), constants.DAPP_PARAMS_EXAMPLE, "Erroneous App params");
			assert.equal ( await AppInstances[i].m_appHash(),   constants.NULL.BYTES32,        "Erroneous App hash"  );
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
				"3.1415926535",
				constants.NULL.BYTES32,
				{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.equal ( await DatasetInstances[i].m_owner(),         datasetProvider,        "Erroneous Dataset owner" );
			assert.equal ( await DatasetInstances[i].m_datasetName(),   "Dataset #"+i,          "Erroneous Dataset name"  );
			assert.equal ( await DatasetInstances[i].m_datasetParams(), "3.1415926535",         "Erroneous Dataset params");
			assert.equal ( await DatasetInstances[i].m_datasetHash(),   constants.NULL.BYTES32, "Erroneous Dataset hash"  );
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
				10, // lock
				10, // minimum stake
				10, // minimum score
				{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.equal ( await WorkerpoolInstances[i].m_owner(),                           scheduler,        "Erroneous Workerpool owner"      );
			assert.equal ( await WorkerpoolInstances[i].m_workerpoolDescription(),           "Workerpool #"+i, "Erroneous Workerpool description");
			assert.equal ((await WorkerpoolInstances[i].m_workerStakeRatioPolicy()),         30,               "Erroneous Workerpool params"     );
			assert.equal ((await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy()),     1,                "Erroneous Workerpool params"     );
			assert.equal ((await WorkerpoolInstances[i].m_subscriptionLockStakePolicy()),    10,               "Erroneous Workerpool params"     );
			assert.equal ((await WorkerpoolInstances[i].m_subscriptionMinimumStakePolicy()), 10,               "Erroneous Workerpool params"     );
			assert.equal ((await WorkerpoolInstances[i].m_subscriptionMinimumScorePolicy()), 10,               "Erroneous Workerpool params"     );
		}
	});

	/***************************************************************************
	 *               TEST: Workerpool configuration (by scheduler)               *
	 ***************************************************************************/
	it("Workerpool Configuration - owner can configure", async () => {
		txMined = await WorkerpoolInstances[1].changePolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, WorkerpoolInstances[1].address, "PolicyUpdate");
		assert.equal(events[0].args.oldWorkerStakeRatioPolicy,         30,  "Erroneous oldWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.newWorkerStakeRatioPolicy,         35,  "Erroneous newWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.oldSchedulerRewardRatioPolicy,     1,   "Erroneous oldSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.newSchedulerRewardRatioPolicy,     5,   "Erroneous newSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.oldSubscriptionMinimumStakePolicy, 10,  "Erroneous oldSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumStakePolicy, 100, "Erroneous newSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.oldSubscriptionMinimumScorePolicy, 10,  "Erroneous oldSubscriptionMinimumScorePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumScorePolicy, 0,   "Erroneous newSubscriptionMinimumScorePolicy");

		assert.equal( await WorkerpoolInstances[1].m_owner(),                           scheduler,       "Erroneous Workerpool owner"      );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),           "Workerpool #1", "Erroneous Workerpool description");
		assert.equal((await WorkerpoolInstances[1].m_workerStakeRatioPolicy()),         35,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy()),     5,               "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionLockStakePolicy()),    10,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,             "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,               "Erroneous Workerpool params"     );
	});

	/***************************************************************************
	 *                   TEST: Workerpool configuration (by user)                    *
	 ***************************************************************************/
	it("Workerpool Configuration #2 - owner restriction apply", async () => {
		try
		{
			await WorkerpoolInstances[1].changePolicy(
				0,
				0,
				0,
				0,
				{ from: user, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("user should not be able to change policy");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal( await WorkerpoolInstances[1].m_owner(),                           scheduler,       "Erroneous Workerpool owner"      );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),           "Workerpool #1", "Erroneous Workerpool description");
		assert.equal((await WorkerpoolInstances[1].m_workerStakeRatioPolicy()),         35,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy()),     5,               "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionLockStakePolicy()),    10,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,             "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,               "Erroneous Workerpool params"     );
	});

	/***************************************************************************
	 *           TEST: Invalid workerpool configuration (by scheduler)           *
	 ***************************************************************************/
	it("Workerpool Configuration #3 - invalid configuration refused", async () => {
		try
		{
			await WorkerpoolInstances[1].changePolicy(
				100, // worker stake ratio
				150, // scheduler reward ratio (should not be above 100%)
				0,   // minimum stake
				0,   // minimum score
				{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.fail("user should not be able to set invalid policy");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal( await WorkerpoolInstances[1].m_owner(),                           scheduler,       "Erroneous Workerpool owner"      );
		assert.equal( await WorkerpoolInstances[1].m_workerpoolDescription(),           "Workerpool #1", "Erroneous Workerpool description");
		assert.equal((await WorkerpoolInstances[1].m_workerStakeRatioPolicy()),         35,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy()),     5,               "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionLockStakePolicy()),    10,              "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,             "Erroneous Workerpool params"     );
		assert.equal((await WorkerpoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,               "Erroneous Workerpool params"     );
	});

});
