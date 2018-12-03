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
	 *                             TEST: creation                              *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);
	});

	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance = await Dataset.at(events[0].args.dataset);
	});

	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A test workerpool", { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);
	});

	it("[Genesis] create orders", async () => {
		apporder = {
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                0x0,
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       3,
			volume:             1000,
			tag:                0x0,
			apprestrict:        AppInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		workerpoolorder = {
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            3,
			tag:               0x0,
			category:          4,
			trust:             1000,
			apprestrict:       AppInstance.address,
			datasetrestrict:   DatasetInstance.address,
			requesterrestrict: user,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE
		};
		requestorder = {
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         WorkerpoolInstance.address,
			workerpoolmaxprice: 25,
			volume:             1,
			tag:                0x0,
			category:           4,
			trust:              1000,
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "app params",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		apporder_hash        = odbtools.AppOrderStructHash       (apporder       );
		datasetorder_hash    = odbtools.DatasetOrderStructHash   (datasetorder   );
		workerpoolorder_hash = odbtools.WorkerpoolOrderStructHash(workerpoolorder);
		requestorder_hash    = odbtools.RequestOrderStructHash   (requestorder   );

		txsMined = await Promise.all([
			IexecClerkInstance.signAppOrder       (apporder,        { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.signDatasetOrder   (datasetorder,    { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.signWorkerpoolOrder(workerpoolorder, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.signRequestOrder   (requestorder,    { from: user,            gas: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                            TEST: App cancel                            *
	 ***************************************************************************/
	it("presign app order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(apporder_hash), 0, "Error in app order presign");
		try
		{
			await IexecClerkInstance.cancelAppOrder(apporder, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.fail("user should not be able to sign apporder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(apporder_hash), 0, "Error in app order presign");
	});

	it("presign app order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(apporder_hash), 0, "Error in app order presign");
		await IexecClerkInstance.cancelAppOrder(apporder, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.equal(await IexecClerkInstance.viewConsumed(apporder_hash), apporder.volume, "Error in app order presign");
	});

	/***************************************************************************
	 *                            TEST: Dataset cancel                            *
	 ***************************************************************************/
	it("presign dataset order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(datasetorder_hash), 0, "Error in dataset order presign");
		try
		{
			await IexecClerkInstance.cancelDatasetOrder(datasetorder, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.fail("user should not be able to sign datasetorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(datasetorder_hash), 0, "Error in dataset order presign");
	});

	it("presign dataset order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(datasetorder_hash), 0, "Error in dataset order presign");
		await IexecClerkInstance.cancelDatasetOrder(datasetorder, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.equal(await IexecClerkInstance.viewConsumed(datasetorder_hash), datasetorder.volume, "Error in dataset order presign");
	});

	/***************************************************************************
	 *                            TEST: Workerpool cancel                            *
	 ***************************************************************************/
	it("presign workerpool order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(workerpoolorder_hash), 0, "Error in workerpool order presign");
		try
		{
			await IexecClerkInstance.cancelWorkerpoolOrder(workerpoolorder, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.fail("user should not be able to sign workerpoolorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(workerpoolorder_hash), 0, "Error in workerpool order presign");
	});

	it("presign workerpool order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(workerpoolorder_hash), 0, "Error in workerpool order presign");
		await IexecClerkInstance.cancelWorkerpoolOrder(workerpoolorder, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.equal(await IexecClerkInstance.viewConsumed(workerpoolorder_hash), workerpoolorder.volume, "Error in workerpool order presign");
	});

	/***************************************************************************
	 *                          TEST: Request cancel                           *
	 ***************************************************************************/
	it("presign request order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(requestorder_hash), 0, "Error in request order presign");
		try
		{
			await IexecClerkInstance.cancelRequestOrder(requestorder, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.fail("user should not be able to sign requestorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(requestorder_hash), 0, "Error in request order presign");
	});

	it("presign request order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(requestorder_hash), 0, "Error in request order presign");
		await IexecClerkInstance.cancelRequestOrder(requestorder, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.equal(await IexecClerkInstance.viewConsumed(requestorder_hash), requestorder.volume, "Error in request order presign");
	});

});
