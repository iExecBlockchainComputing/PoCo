/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

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

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Registries', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = null;
	let appProvider     = null;
	let datasetProvider = null;
	let scheduler       = null;
	let worker1         = null;
	let worker2         = null;
	let worker3         = null;
	let worker4         = null;
	let worker5         = null;
	let user            = null;

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
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.at(await IexecInstance.token());

		broker          = new odbtools.Broker    (IexecInstance);
		iexecAdmin      = new odbtools.iExecAgent(IexecInstance, accounts[0]);
		appProvider     = new odbtools.iExecAgent(IexecInstance, accounts[1]);
		datasetProvider = new odbtools.iExecAgent(IexecInstance, accounts[2]);
		scheduler       = new odbtools.Scheduler (IexecInstance, accounts[3]);
		worker1         = new odbtools.Worker    (IexecInstance, accounts[4]);
		worker2         = new odbtools.Worker    (IexecInstance, accounts[5]);
		worker3         = new odbtools.Worker    (IexecInstance, accounts[6]);
		worker4         = new odbtools.Worker    (IexecInstance, accounts[7]);
		worker5         = new odbtools.Worker    (IexecInstance, accounts[8]);
		user            = new odbtools.iExecAgent(IexecInstance, accounts[9]);
		await broker.initialize();
	});

	describe("Registry", async () => {
		it("cannot reinitialize", async () => {
			await expectRevert.unspecified(AppRegistryInstance.initialize(constants.NULL.ADDRESS));
			await expectRevert.unspecified(DatasetRegistryInstance.initialize(constants.NULL.ADDRESS));
			await expectRevert.unspecified(WorkerpoolRegistryInstance.initialize(constants.NULL.ADDRESS));
		});
		it("baseURI", async () => {
			const chainid = await web3.eth.net.getId();
			assert.equal(await AppRegistryInstance.baseURI(),        `https://nfts-metadata.iex.ec/app/${chainid}/`);
			assert.equal(await DatasetRegistryInstance.baseURI(),    `https://nfts-metadata.iex.ec/dataset/${chainid}/`);
			assert.equal(await WorkerpoolRegistryInstance.baseURI(), `https://nfts-metadata.iex.ec/workerpool/${chainid}/`);
		});
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
						{ t: 'bytes',   v: args                },
						{ t: 'address', v: appProvider.address },
					);
					const predictedAddress = tools.create2(AppRegistryInstance.address, code, salt);

					assert.equal(await AppRegistryInstance.predictApp(
							appProvider.address,
							"App #"+i,
							"DOCKER",
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of app #"+i),
							"0x1234"
						),
						predictedAddress
					);

					txMined = await AppRegistryInstance.createApp(
						appProvider.address,
						"App #"+i,
						"DOCKER",
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of app #"+i),
						"0x1234",
						{ from: appProvider.address }
					);

					events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      appProvider.address);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					AppInstances[i] = await App.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await AppInstances[i].registry(),       AppRegistryInstance.address               );
					assert.equal (await AppInstances[i].owner(),          appProvider.address                       );
					assert.equal (await AppInstances[i].m_appName(),      "App #"+i                                 );
					assert.equal (await AppInstances[i].m_appType(),      "DOCKER"                                  );
					assert.equal (await AppInstances[i].m_appMultiaddr(), constants.MULTIADDR_BYTES                 );
					assert.equal (await AppInstances[i].m_appChecksum(),  web3.utils.keccak256("Content of app #"+i));
					assert.equal (await AppInstances[i].m_appMREnclave(), "0x1234"                                  );
				});

				it("token details", async () => {
					assert.equal (await AppRegistryInstance.ownerOf(AppInstances[i].address), appProvider.address);
					assert.equal (await AppRegistryInstance.balanceOf(appProvider.address), i+1);
					assert.isTrue(await AppRegistryInstance.isRegistered(AppInstances[i].address));
					assert.equal (tools.BN2Address(await AppRegistryInstance.tokenOfOwnerByIndex(appProvider.address, i)), AppInstances[i].address);
					assert.equal (await AppRegistryInstance.tokenURI(AppInstances[i].address), (await AppRegistryInstance.baseURI()) + web3.utils.toBN(AppInstances[i].address) );
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						AppRegistryInstance.createApp(
							appProvider.address,
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
						{ t: 'bytes',   v: args                    },
						{ t: 'address', v: datasetProvider.address },
					);
					const predictedAddress = tools.create2(DatasetRegistryInstance.address, code, salt);

					assert.equal(await DatasetRegistryInstance.predictDataset(
							datasetProvider.address,
							"Dataset #"+i,
							constants.MULTIADDR_BYTES,
							web3.utils.keccak256("Content of dataset #"+i)
						),
						predictedAddress
					);

					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider.address,
						"Dataset #"+i,
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of dataset #"+i),
						{ from: datasetProvider.address }
					);

					events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      datasetProvider.address);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					DatasetInstances[i] = await Dataset.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await DatasetInstances[i].registry(),           DatasetRegistryInstance.address               );
					assert.equal (await DatasetInstances[i].owner(),              datasetProvider.address                       );
					assert.equal (await DatasetInstances[i].m_datasetName(),      "Dataset #"+i                                 );
					assert.equal (await DatasetInstances[i].m_datasetMultiaddr(), constants.MULTIADDR_BYTES                     );
					assert.equal (await DatasetInstances[i].m_datasetChecksum(),  web3.utils.keccak256("Content of dataset #"+i));
				});

				it("token details", async () => {
					assert.equal (await DatasetRegistryInstance.ownerOf(DatasetInstances[i].address), datasetProvider.address);
					assert.equal (await DatasetRegistryInstance.balanceOf(datasetProvider.address), i+1);
					assert.isTrue(await DatasetRegistryInstance.isRegistered(DatasetInstances[i].address));
					assert.equal (tools.BN2Address(await DatasetRegistryInstance.tokenOfOwnerByIndex(datasetProvider.address, i)), DatasetInstances[i].address);
					assert.equal (await DatasetRegistryInstance.tokenURI(DatasetInstances[i].address), (await DatasetRegistryInstance.baseURI()) + web3.utils.toBN(DatasetInstances[i].address) );
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						DatasetRegistryInstance.createDataset(
							datasetProvider.address,
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
						{ t: 'bytes',   v: args              },
						{ t: 'address', v: scheduler.address },
					);
					const predictedAddress = tools.create2(WorkerpoolRegistryInstance.address, code, salt);

					assert.equal(await WorkerpoolRegistryInstance.predictWorkerpool(
							scheduler.address,
							"Workerpool #"+i
						),
						predictedAddress
					);

					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler.address,
						"Workerpool #"+i,
						{ from: scheduler.address }
					);

					events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
					assert.equal    (events[0].args.from,    constants.NULL.ADDRESS);
					assert.equal    (events[0].args.to,      scheduler.address);
					assert.deepEqual(events[0].args.tokenId, web3.utils.toBN(predictedAddress));
					WorkerpoolInstances[i] = await Workerpool.at(predictedAddress);
				});

				it("content", async () => {
					assert.equal (await WorkerpoolInstances[i].registry(),                     WorkerpoolRegistryInstance.address);
					assert.equal (await WorkerpoolInstances[i].owner(),                        scheduler.address                 );
					assert.equal (await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i                  );
					assert.equal (await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30                                );
					assert.equal (await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                                 );
				});

				it("token details", async () => {
					assert.equal (await WorkerpoolRegistryInstance.ownerOf(WorkerpoolInstances[i].address), scheduler.address);
					assert.equal (await WorkerpoolRegistryInstance.balanceOf(scheduler.address), i+1);
					assert.isTrue(await WorkerpoolRegistryInstance.isRegistered(WorkerpoolInstances[i].address));
					assert.equal (tools.BN2Address(await WorkerpoolRegistryInstance.tokenOfOwnerByIndex(scheduler.address, i)), WorkerpoolInstances[i].address);
					assert.equal (await WorkerpoolRegistryInstance.tokenURI(WorkerpoolInstances[i].address), (await WorkerpoolRegistryInstance.baseURI()) + web3.utils.toBN(WorkerpoolInstances[i].address) );
				});

				it("duplicate protection", async () => {
					await expectRevert.unspecified(
						WorkerpoolRegistryInstance.createWorkerpool(
							scheduler.address,
							"Workerpool #"+i,
						)
					);
				});
			});
		});
	});
});
