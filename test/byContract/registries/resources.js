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
var ENSRegistry        = artifacts.require("@ensdomains/ens/ENSRegistry");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Ressources', async (accounts) => {

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
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();
		ENSInstance                = await ENSRegistry.deployed();
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

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	describe("Apps", async () => {
		Array(8).fill().map((_, i) => {
			describe(`app #${i}`, async () => {
				it("creation", async () => {
					txMined = await AppRegistryInstance.createApp(
						appProvider.address,
						"App #"+i,
						"DOCKER",
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of app #"+i),
						"0x1234",
						{ from: appProvider.address }
					);
					AppInstances[i] = await App.at(tools.BN2Address(tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await AppInstances[i].registry(),       AppRegistryInstance.address               );
					assert.equal(await AppInstances[i].owner(),          appProvider.address                       );
					assert.equal(await AppInstances[i].m_appName(),      "App #"+i                                 );
					assert.equal(await AppInstances[i].m_appType(),      "DOCKER"                                  );
					assert.equal(await AppInstances[i].m_appMultiaddr(), constants.MULTIADDR_BYTES                 );
					assert.equal(await AppInstances[i].m_appChecksum(),  web3.utils.keccak256("Content of app #"+i));
					assert.equal(await AppInstances[i].m_appMREnclave(), "0x1234"                                  );
				});

				it("reverse registration", async () => {
					ensname = "app#"+i+".apps.iexec.eth";
					await AppInstances[i].setName(ENSInstance.address, ensname, { from: appProvider.address });
					assert.equal(await enstools.lookup(AppInstances[i].address), ensname);
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
					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider.address,
						"Dataset #"+i,
						constants.MULTIADDR_BYTES,
						web3.utils.keccak256("Content of dataset #"+i),
						{ from: datasetProvider.address }
					);
					DatasetInstances[i] = await Dataset.at(tools.BN2Address(tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await DatasetInstances[i].registry(),           DatasetRegistryInstance.address               );
					assert.equal(await DatasetInstances[i].owner(),              datasetProvider.address                       );
					assert.equal(await DatasetInstances[i].m_datasetName(),      "Dataset #"+i                                 );
					assert.equal(await DatasetInstances[i].m_datasetMultiaddr(), constants.MULTIADDR_BYTES                     );
					assert.equal(await DatasetInstances[i].m_datasetChecksum(),  web3.utils.keccak256("Content of dataset #"+i));
				});

				it("reverse registration", async () => {
					ensname = "dataset#"+i+".datasets.iexec.eth";
					await DatasetInstances[i].setName(ENSInstance.address, ensname, { from: datasetProvider.address });
					assert.equal(await enstools.lookup(DatasetInstances[i].address), ensname);
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
					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler.address,
						"Workerpool #"+i,
						{ from: scheduler.address }
					);
					WorkerpoolInstances[i] = await Workerpool.at(tools.BN2Address(tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer")[0].args.tokenId));
				});

				it("content", async () => {
					assert.equal(await WorkerpoolInstances[i].registry(),                     WorkerpoolRegistryInstance.address);
					assert.equal(await WorkerpoolInstances[i].owner(),                        scheduler.address                 );
					assert.equal(await WorkerpoolInstances[i].m_workerpoolDescription(),      "Workerpool #"+i                  );
					assert.equal(await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),     30                                );
					assert.equal(await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(), 1                                 );
				});

				it("reverse registration", async () => {
					ensname = "workerpools#"+i+".workerpools.iexec.eth";
					await WorkerpoolInstances[i].setName(ENSInstance.address, ensname, { from: scheduler.address });
					assert.equal(await enstools.lookup(WorkerpoolInstances[i].address), ensname);
				});
			});
		});

		describe("configuration", async () => {
			it("owner can configure", async () => {
				txMined = await WorkerpoolInstances[1].changePolicy(
					35,  // worker stake ratio
					5,   // scheduler reward ratio
					{ from: scheduler.address }
				);

				events = tools.extractEvents(txMined, WorkerpoolInstances[1].address, "PolicyUpdate");
				assert.equal(events[0].args.oldWorkerStakeRatioPolicy,     30 );
				assert.equal(events[0].args.newWorkerStakeRatioPolicy,     35 );
				assert.equal(events[0].args.oldSchedulerRewardRatioPolicy, 1  );
				assert.equal(events[0].args.newSchedulerRewardRatioPolicy, 5  );

				assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler.address);
				assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1"  );
				assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35               );
				assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5                );
			});

			it("owner restriction apply", async () => {
				await expectRevert.unspecified(WorkerpoolInstances[1].changePolicy(
					0,
					0,
					{ from: user.address }
				));

				assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler.address);
				assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1"  );
				assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35               );
				assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5                );
			});

			it("invalid configuration refused", async () => {
				await expectRevert.unspecified(WorkerpoolInstances[1].changePolicy(
					100, // worker stake ratio
					150, // scheduler reward ratio (should not be above 100%)
					{ from: scheduler.address }
				));

				assert.equal(await WorkerpoolInstances[1].owner(),                        scheduler.address);
				assert.equal(await WorkerpoolInstances[1].m_workerpoolDescription(),      "Workerpool #1"  );
				assert.equal(await WorkerpoolInstances[1].m_workerStakeRatioPolicy(),     35               );
				assert.equal(await WorkerpoolInstances[1].m_schedulerRewardRatioPolicy(), 5                );
			});
		});
	});
});
