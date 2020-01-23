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

contract('Ressources', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let teebroker       = web3.eth.accounts.create();
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
		ENSInstance                = await ENSRegistry.deployed();

		await IexecInstance.setTeeBroker(teebroker.address);
		ERC712_domain = await IexecInstance.domain();
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	describe("Apps", async () => {
		Array(8).fill().map((_, i) => {
			describe(`app #${i}`, async () => {
				it("creation", async () => {
					txMined = await AppRegistryInstance.createApp(
						appProvider,
						"App #"+i,
						"DOCKER",
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of app #"+i),
						"0x1234",
						{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					AppInstances[i] = await App.at(tools.BN2Address(tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await AppInstances[i].registry(),       AppRegistryInstance.address               );
					assert.equal(await AppInstances[i].owner(),          appProvider                               );
					assert.equal(await AppInstances[i].m_appName(),      "App #"+i                                 );
					assert.equal(await AppInstances[i].m_appType(),      "DOCKER"                                  );
					assert.equal(await AppInstances[i].m_appMultiaddr(), constants.MULTIADDR_BYTES                 );
					assert.equal(await AppInstances[i].m_appChecksum(),  web3.utils.keccak256("Content of app #"+i));
					assert.equal(await AppInstances[i].m_appMREnclave(), "0x1234"                                  );
				});

				it("reverse registration", async () => {
					ensname = "app#"+i+".apps.iexec.eth";
					await AppInstances[i].setName(ENSInstance.address, ensname, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.equal(await enstools.lookup(AppInstances[i].address), ensname);
				});
			});
		});
	});

	/***************************************************************************
	 *                  TEST: Dataset creation (by datasetProvider)                  *
	 ***************************************************************************/
	describe("Datasets", async () => {
		Array(8).fill().map((_, i) => {
			describe(`dataset #${i}`, async () => {
				it("creation", async () => {
					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider,
						"Dataset #"+i,
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of dataset #"+i),
						{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					DatasetInstances[i] = await Dataset.at(tools.BN2Address(tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await DatasetInstances[i].registry(),           DatasetRegistryInstance.address               );
					assert.equal(await DatasetInstances[i].owner(),              datasetProvider                               );
					assert.equal(await DatasetInstances[i].m_datasetName(),      "Dataset #"+i                                 );
					assert.equal(await DatasetInstances[i].m_datasetMultiaddr(), constants.MULTIADDR_BYTES                     );
					assert.equal(await DatasetInstances[i].m_datasetChecksum(),  web3.utils.keccak256("Content of dataset #"+i));
				});

				it("reverse registration", async () => {
					ensname = "dataset#"+i+".datasets.iexec.eth";
					await DatasetInstances[i].setName(ENSInstance.address, ensname, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.equal(await enstools.lookup(DatasetInstances[i].address), ensname);
				});
			});
		});
	});

	/***************************************************************************
	 *                 TEST: Workerpool creation (by scheduler)                  *
	 ***************************************************************************/
	describe("Workerpools", async () => {
		Array(8).fill().map((_, i) => {
			describe(`workerpool #${i}`, async () => {
				it("creation", async () => {
					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler,
						"Workerpool #"+i,
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					WorkerpoolInstances[i] = await Workerpool.at(tools.BN2Address(tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await WorkerpoolInstances[i].registry(),                     WorkerpoolRegistryInstance.address);
					assert.equal(await WorkerpoolInstances[i].owner(),                        scheduler                         );
					assert.equal(await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i                  );
					assert.equal(await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30                                );
					assert.equal(await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                                 );
				});

				it("reverse registration", async () => {
					ensname = "workerpools#"+i+".workerpools.iexec.eth";
					await WorkerpoolInstances[i].setName(ENSInstance.address, ensname, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.equal(await enstools.lookup(WorkerpoolInstances[i].address), ensname);
				});
			});
		});

		describe("configuration", async () => {
			it("owner can configure", async () => {
				txMined = await WorkerpoolInstances[1].changePolicy(
					35,  // worker stake ratio
					5,   // scheduler reward ratio
					{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
				);
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				events = tools.extractEvents(txMined, WorkerpoolInstances[1].address, "PolicyUpdate");
				assert.equal(events[0].args.oldWorkerStakeRatioPolicy,     30 );
				assert.equal(events[0].args.newWorkerStakeRatioPolicy,     35 );
				assert.equal(events[0].args.oldSchedulerRewardRatioPolicy, 1  );
				assert.equal(events[0].args.newSchedulerRewardRatioPolicy, 5  );

				assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler      );
				assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1");
				assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35             );
				assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5              );
			});

			it("owner restriction apply", async () => {
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

			it("invalid configuration refused", async () => {
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
	});
});
