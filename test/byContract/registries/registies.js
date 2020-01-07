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

contract('Registries', async (accounts) => {

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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	});

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	describe("Apps", async () => {
		Array(8).fill().map((_, i) => {
			describe(`app #${i}`, async () => {
				it("creation", async () => {
					const code = await AppRegistryInstance.proxyCode();
					const args = web3.eth.abi.encodeFunctionCall(
						App.abi.find(e => e.name == 'initialize'),
						[
							"App #"+i,
							"DOCKER",
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of app #"+i),
							"0x1234",
						]
					);
					const salt = web3.utils.soliditySha3(
						{ t: 'bytes',   v: args        },
						{ t: 'address', v: appProvider },
					);
					const predictedAddress = tools.create2(AppRegistryInstance.address, code, salt);

					txMined = await AppRegistryInstance.createApp(
						appProvider,
						"App #"+i,
						"DOCKER",
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of app #"+i),
						"0x1234",
						{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      appProvider);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					AppInstances[i] = await App.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await AppInstances[i].registry(),       AppRegistryInstance.address               );
					assert.equal (await AppInstances[i].owner(),          appProvider                               );
					assert.equal (await AppInstances[i].m_appName(),      "App #"+i                                 );
					assert.equal (await AppInstances[i].m_appType(),      "DOCKER"                                  );
					assert.equal (await AppInstances[i].m_appMultiaddr(), constants.MULTIADDR_BYTES                 );
					assert.equal (await AppInstances[i].m_appChecksum(),  web3.utils.keccak256("Content of app #"+i));
					assert.equal (await AppInstances[i].m_appMREnclave(), "0x1234"                                  );
				});

				it("token details", async () => {
					assert.equal (await AppRegistryInstance.ownerOf(AppInstances[i].address),                appProvider                  );
					assert.equal (await AppRegistryInstance.balanceOf(appProvider),                          i+1                          );
					assert.isTrue(await AppRegistryInstance.isRegistered(AppInstances[i].address)                                         );
					assert.equal (tools.BN2Address(await AppRegistryInstance.tokenOfOwnerByIndex(appProvider, i)), AppInstances[i].address);
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						AppRegistryInstance.createApp(
							appProvider,
							"App #"+i,
							"DOCKER",
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of app #"+i),
							"0x1234",
						)
					);
				});
			});
		});
	});

	/***************************************************************************
	 *               TEST: Dataset creation (by datasetProvider)               *
	 ***************************************************************************/
	describe("Datasets", async () => {
		Array(8).fill().map((_, i) => {
			describe(`dataset #${i}`, async () => {
				it("creation", async () => {
					const code = await AppRegistryInstance.proxyCode();
					const args = web3.eth.abi.encodeFunctionCall(
						Dataset.abi.find(e => e.name == 'initialize'),
						[
							"Dataset #"+i,
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of dataset #"+i),
						]
					);
					const salt = web3.utils.soliditySha3(
						{ t: 'bytes',   v: args            },
						{ t: 'address', v: datasetProvider },
					);
					const predictedAddress = tools.create2(DatasetRegistryInstance.address, code, salt);

					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider,
						"Dataset #"+i,
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of dataset #"+i),
						{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      datasetProvider);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					DatasetInstances[i] = await Dataset.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await DatasetInstances[i].registry(),           DatasetRegistryInstance.address               );
					assert.equal (await DatasetInstances[i].owner(),              datasetProvider                               );
					assert.equal (await DatasetInstances[i].m_datasetName(),      "Dataset #"+i                                 );
					assert.equal (await DatasetInstances[i].m_datasetMultiaddr(), constants.MULTIADDR_BYTES                     );
					assert.equal (await DatasetInstances[i].m_datasetChecksum(),  web3.utils.keccak256("Content of dataset #"+i));
				});

				it("token details", async () => {
					assert.equal (await DatasetRegistryInstance.ownerOf(DatasetInstances[i].address),                datasetProvider                  );
					assert.equal (await DatasetRegistryInstance.balanceOf(datasetProvider),                          i+1                              );
					assert.isTrue(await DatasetRegistryInstance.isRegistered(DatasetInstances[i].address)                                             );
					assert.equal (tools.BN2Address(await DatasetRegistryInstance.tokenOfOwnerByIndex(datasetProvider, i)), DatasetInstances[i].address);
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						DatasetRegistryInstance.createDataset(
							datasetProvider,
							"Dataset #"+i,
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of dataset #"+i),
						)
					);
				});
			});
		});
	});

	/***************************************************************************
	 *                TEST: Workerpool creation (by scheduler)                 *
	 ***************************************************************************/
	describe("Workerpools", async () => {
		Array(8).fill().map((_, i) => {
			describe(`workerpool #${i}`, async () => {
				it("creation", async () => {
					const code = await AppRegistryInstance.proxyCode();
					const args = web3.eth.abi.encodeFunctionCall(
						Workerpool.abi.find(e => e.name == 'initialize'),
						[
							"Workerpool #"+i,
						]
					);
					const salt = web3.utils.soliditySha3(
						{ t: 'bytes',   v: args      },
						{ t: 'address', v: scheduler },
					);
					const predictedAddress = tools.create2(WorkerpoolRegistryInstance.address, code, salt);

					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler,
						"Workerpool #"+i,
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      scheduler);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					WorkerpoolInstances[i] = await Workerpool.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await WorkerpoolInstances[i].registry(),                     WorkerpoolRegistryInstance.address   );
					assert.equal (await WorkerpoolInstances[i].owner(),                        scheduler                            );
					assert.equal (await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i                     );
					assert.equal (await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30                                   );
					assert.equal (await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                                    );
				});

				it("token details", async () => {
					assert.equal (await WorkerpoolRegistryInstance.ownerOf(WorkerpoolInstances[i].address),       scheduler                           );
					assert.equal (await WorkerpoolRegistryInstance.balanceOf(scheduler),                          i+1                                 );
					assert.isTrue(await WorkerpoolRegistryInstance.isRegistered(WorkerpoolInstances[i].address)                                       );
					assert.equal (tools.BN2Address(await WorkerpoolRegistryInstance.tokenOfOwnerByIndex(scheduler, i)), WorkerpoolInstances[i].address);
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						WorkerpoolRegistryInstance.createWorkerpool(
							scheduler,
							"Workerpool #"+i,
						)
					);
				});
			});
		});
	});
});
