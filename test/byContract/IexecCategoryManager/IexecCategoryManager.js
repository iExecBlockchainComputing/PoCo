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
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('CategoryManager', async (accounts) => {

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

	var categories = [];

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

	describe("view", async () => {
		describe("invalid index", async () => {
			it("reverts", async () => {
				assert.equal(await IexecInstance.countCategory(), 5, "Error in category count");
				await expectRevert.unspecified(IexecInstance.viewCategory(5));
				assert.equal(await IexecInstance.countCategory(), 5, "Error in category count");
			});
		});
	});

	describe("create", async () => {
		describe("unauthorized create", async () => {
			it("reverts", async () => {
				assert.equal(await IexecInstance.countCategory(), 5, "Error in category count");
				await expectRevert.unspecified(IexecInstance.createCategory("fake category", "this is an attack", 0xFFFFFFFFFF, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
				assert.equal(await IexecInstance.countCategory(), 5, "Error in category count");
			});
		});

		describe("authorized", async () => {
			it("success", async () => {
				assert.equal(await IexecInstance.countCategory(), 5, "Error in category count");

				txMined = await IexecInstance.createCategory("Tiny", "Small but impractical", 3, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("emits event", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "CreateCategory");
				assert.equal(events[0].args.catid,            5,                       "check catid"           );
				assert.equal(events[0].args.name,             "Tiny",                  "check name"            );
				assert.equal(events[0].args.description,      "Small but impractical", "check description"     );
				assert.equal(events[0].args.workClockTimeRef, 3,                       "check workClockTimeRef");
			});

			it("count update", async () => {
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");
			});

			it("view newly created category", async () => {
				category = await IexecInstance.viewCategory(5);
				assert.equal(category.name,             "Tiny",                  "check name"            );
				assert.equal(category.description,      "Small but impractical", "check description"     );
				assert.equal(category.workClockTimeRef, 3,                       "check workClockTimeRef");
			});
		});
	});
});
