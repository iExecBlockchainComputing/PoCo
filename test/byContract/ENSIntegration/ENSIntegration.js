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
var ENSRegistry        = artifacts.require("@ensdomains/ens/ENSRegistry");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const multiaddr = require('multiaddr');
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('ENSIntegration', async (accounts) => {

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
	var ENSInstance                = null;

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
		ERC712_domain              = await IexecInstance.domain();
		ENSInstance                = await ENSRegistry.deployed();

		agentBroker    = new odbtools.MockBroker(IexecInstance);
		agentScheduler = new odbtools.MockScheduler(scheduler);
		await agentBroker.initialize();
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	describe("Initial state (migration)", async () => {
		it("lookup", async () => {
			if (DEPLOYMENT.asset == "Token") try {
				await enstools.lookup(RLCInstance.address);
				assert(false);
			} catch(e) {}
			assert.equal(await enstools.lookup(IexecInstance.address             ), "hub.iexec.eth"                );
			assert.equal(await enstools.lookup(AppRegistryInstance.address       ), "apps.registry.iexec.eth"       );
			assert.equal(await enstools.lookup(DatasetRegistryInstance.address   ), "datasets.registry.iexec.eth"   );
			assert.equal(await enstools.lookup(WorkerpoolRegistryInstance.address), "workerpools.registry.iexec.eth");
		})
		it("resolve", async () => {
			if (DEPLOYMENT.asset == "Token") {
				assert.equal(await enstools.resolve("rlc.iexec.eth"               ), RLCInstance.address               );
			}
			assert.equal(await enstools.resolve("hub.iexec.eth"                 ), IexecInstance.address             );
			assert.equal(await enstools.resolve("apps.registry.iexec.eth"       ), AppRegistryInstance.address       );
			assert.equal(await enstools.resolve("datasets.registry.iexec.eth"   ), DatasetRegistryInstance.address   );
			assert.equal(await enstools.resolve("workerpools.registry.iexec.eth"), WorkerpoolRegistryInstance.address);
		});
	});

	describe("Reverse register", async () => {
		describe("unauthorized", async () => {
			it("reverts", async () => {
				await expectRevert(IexecInstance.setName(ENSInstance.address, "wrong.domain.eth", { from: user, gas: constants.AMOUNT_GAS_PROVIDED }), "Ownable: caller is not the owner");
			});
		});

		describe("authorized", async () => {
			it("success", async () => {
				txMined = await IexecInstance.setName(ENSInstance.address, "test.namespace.eth", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("lookup", async () => {
				assert.equal(await enstools.lookup(IexecInstance.address), "test.namespace.eth");
			});
		});
	});
});
