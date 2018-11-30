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

	var AppInstances        = {};
	var DatasetInstances    = {};
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
			txMined = await AppRegistryInstance.createApp(appProvider, "App #"+i, constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
			assert.equal(events[0].args.appOwner,  appProvider,                   "Erroneous App owner" );
			assert.equal(events[0].args.appName,   "App #"+i,                     "Erroneous App name"  );
			assert.equal(events[0].args.appParams, constants.DAPP_PARAMS_EXAMPLE, "Erroneous App params");
			assert.equal(events[0].args.appHash,   constants.NULL.BYTES32,        "Erroneous App hash"  );

			AppInstances[i] = await App.at(events[0].args.app);
			assert.equal (await AppInstances[i].m_owner(),                                 appProvider,                   "Erroneous App owner"                 );
			assert.equal (await AppInstances[i].m_appName(),                               "App #"+i,                     "Erroneous App name"                  );
			assert.equal (await AppInstances[i].m_appParams(),                             constants.DAPP_PARAMS_EXAMPLE, "Erroneous App params"                );
			assert.equal (await AppRegistryInstance.viewCount(appProvider),                i,                             "appProvider must have 1 more app now");
			assert.equal (await AppRegistryInstance.viewEntry(appProvider, i),             AppInstances[i].address,       "check appAddress"                    );
			assert.isTrue(await AppRegistryInstance.isRegistered(AppInstances[i].address),                                "check app registration"              );
		}
	});

	/***************************************************************************
	 *                  TEST: Dataset creation (by datasetProvider)                  *
	 ***************************************************************************/
	it("Dataset Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Dataset #"+i, "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
			assert.equal(events[0].args.datasetOwner,  datasetProvider,        "Erroneous Dataset owner" );
			assert.equal(events[0].args.datasetName,   "Dataset #"+i,          "Erroneous Dataset name"  );
			assert.equal(events[0].args.datasetParams, "3.1415926535",         "Erroneous Dataset params");
			assert.equal(events[0].args.datasetHash,   constants.NULL.BYTES32, "Erroneous Dataset hash"  );

			DatasetInstances[i] = await Dataset.at(events[0].args.dataset);
			assert.equal (await DatasetInstances[i].m_owner(),                                     datasetProvider,             "Erroneous Dataset owner"                     );
			assert.equal (await DatasetInstances[i].m_datasetName(),                               "Dataset #"+i,               "Erroneous Dataset name"                      );
			assert.equal (await DatasetInstances[i].m_datasetParams(),                             "3.1415926535",              "Erroneous Dataset params"                    );
			assert.equal (await DatasetRegistryInstance.viewCount(datasetProvider),                i,                           "datasetProvider must have 1 more dataset now");
			assert.equal (await DatasetRegistryInstance.viewEntry(datasetProvider, i),             DatasetInstances[i].address, "check datasetAddress"                        );
			assert.isTrue(await DatasetRegistryInstance.isRegistered(DatasetInstances[i].address),                              "check dataset registration"                  );
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
				10, // lock
				10, // minimum stake
				10, // minimum score
				{ from: scheduler }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
			assert.equal(events[0].args.workerpoolOwner,       scheduler,        "Erroneous Workerpool owner"      );
			assert.equal(events[0].args.workerpoolDescription, "Workerpool #"+i, "Erroneous Workerpool description");

			WorkerpoolInstances[i] = await Workerpool.at(events[0].args.workerpool);
			assert.equal (await WorkerpoolInstances[i].m_owner(),                                        scheduler,                      "Erroneous Workerpool owner"                   );
			assert.equal (await WorkerpoolInstances[i].m_workerpoolDescription(),                        "Workerpool #"+i,               "Erroneous Workerpool description"             );
			assert.equal (await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),                       30,                             "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(),                   1,                              "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolInstances[i].m_subscriptionLockStakePolicy(),                  10,                             "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolInstances[i].m_subscriptionMinimumStakePolicy(),               10,                             "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolInstances[i].m_subscriptionMinimumScorePolicy(),               10,                             "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolRegistryInstance.viewCount(scheduler),                         i,                              "scheduler must have 1 more workerpool now");
			assert.equal (await WorkerpoolRegistryInstance.viewEntry(scheduler, i),                      WorkerpoolInstances[i].address, "check workerpoolAddress"                      );
			assert.isTrue(await WorkerpoolRegistryInstance.isRegistered(WorkerpoolInstances[i].address),                                 "check workerpool registration"                );
		}
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("Check internals", async () => {
		assert.equal(DatasetRegistryInstance.contract.insert,    undefined, "expected insert internal");
		assert.equal(AppRegistryInstance.contract.insert,        undefined, "expected insert internal");
		assert.equal(WorkerpoolRegistryInstance.contract.insert, undefined, "expected insert internal");
	});

});
