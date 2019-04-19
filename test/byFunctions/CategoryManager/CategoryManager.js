var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");

const { shouldFail } = require('openzeppelin-test-helpers');
const   multiaddr    = require('multiaddr');
const   constants    = require("../../../utils/constants");
const   odbtools     = require('../../../utils/odb-tools');
const   wallets      = require('../../../utils/wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub: Category manager', async (accounts) => {

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

	var categories = [];

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
	 *                    CategoryManager is OwnableMutable                    *
	 ***************************************************************************/
	it("CategoryManager - cant transfer ownership to null address", async () => {
		assert.equal( await IexecHubInstance.owner(), iexecAdmin, "Erroneous Workerpool owner");
		await shouldFail.reverting(IexecHubInstance.transferOwnership(constants.NULL.ADDRESS, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
		assert.equal( await IexecHubInstance.owner(), iexecAdmin, "Erroneous Workerpool owner");
	});

	/***************************************************************************
	 *                    CategoryManager - create and view                    *
	 ***************************************************************************/
	it("CategoryManager - create and view #1: view fail", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
		await shouldFail.throwing(IexecHubInstance.viewCategory(7));
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
	});

	it("CategoryManager - create and view #2: unauthorized create", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
		await shouldFail.reverting(IexecHubInstance.createCategory("fake category", "this is an attack", 0xFFFFFFFFFF, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
	});

	it("CategoryManager - create and view #3: authorized create", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");

		txMined = await IexecHubInstance.createCategory("Tiny", "Small but impractical", 3, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "CreateCategory");
		assert.equal(events[0].args.catid,            7,                       "check catid"           );
		assert.equal(events[0].args.name,             "Tiny",                  "check name"            );
		assert.equal(events[0].args.description,      "Small but impractical", "check description"     );
		assert.equal(events[0].args.workClockTimeRef, 3,                       "check workClockTimeRef");

		assert.equal(await IexecHubInstance.countCategory(), 8, "Error in category count");
	});

	it("CategoryManager - create and view #4: view created", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 8, "Error in category count");

		category = await IexecHubInstance.viewCategory(7);
		assert.equal(category.name,             "Tiny",                  "check name"            );
		assert.equal(category.description,      "Small but impractical", "check description"     );
		assert.equal(category.workClockTimeRef, 3,                       "check workClockTimeRef");

		assert.equal(await IexecHubInstance.countCategory(), 8, "Error in category count");
	});
});
