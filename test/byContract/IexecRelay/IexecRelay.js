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

contract('Relay', async (accounts) => {

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

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder        = null;
	var datasetorder    = null;
	var workerpoolorder = null;
	var requestorder    = null;

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

	describe("→ setup", async () => {
		describe("assets", async () => {
			describe("app", async () => {
				it("create", async () => {
					txMined = await AppRegistryInstance.createApp(
						appProvider.address,
						"R Clifford Attractors",
						"DOCKER",
						constants.MULTIADDR_BYTES,
						constants.NULL.BYTES32,
						"0x",
						{ from: appProvider.address }
					);
					events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
					AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));
				});
			});

			describe("dataset", async () => {
				it("create", async () => {
					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider.address,
						"Pi",
						constants.MULTIADDR_BYTES,
						constants.NULL.BYTES32,
						{ from: datasetProvider.address }
					);
					events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
					DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));
				});
			});

			describe("workerpool", async () => {
				it("create", async () => {
					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler.address,
						"A test workerpool",
						{ from: scheduler.address }
					);
					events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
					WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));
				});

				it("change policy", async () => {
					await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler.address });
				});
			});
		});

		describe("orders", async () => {
			describe("app", async () => {
				it("sign", async () => {
					apporder = await appProvider.signAppOrder({
						app:                AppInstance.address,
						appprice:           3,
						volume:             1000,
						tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
						datasetrestrict:    constants.NULL.ADDRESS,
						workerpoolrestrict: constants.NULL.ADDRESS,
						requesterrestrict:  constants.NULL.ADDRESS,
						salt:               web3.utils.randomHex(32),
						sign:               constants.NULL.SIGNATURE,
					});
				});

				it("verify", async () => {
					assert.isTrue(await IexecInstance.verifySignature(
						appProvider.address,
						odbtools.utils.hashAppOrder(ERC712_domain, apporder),
						apporder.sign
					));
				});
			});

			describe("dataset", async () => {
				it("sign", async () => {
					datasetorder = await datasetProvider.signDatasetOrder({
						dataset:            DatasetInstance.address,
						datasetprice:       1,
						volume:             1000,
						tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
						apprestrict:        constants.NULL.ADDRESS,
						workerpoolrestrict: constants.NULL.ADDRESS,
						requesterrestrict:  constants.NULL.ADDRESS,
						salt:               web3.utils.randomHex(32),
						sign:               constants.NULL.SIGNATURE,
					});
				});

				it("verify", async () => {
					assert.isTrue(await IexecInstance.verifySignature(
						datasetProvider.address,
						odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder),
						datasetorder.sign
					));
				});
			});

			describe("workerpool", async () => {
				it("sign", async () => {
					workerpoolorder = await scheduler.signWorkerpoolOrder({
						workerpool:        WorkerpoolInstance.address,
						workerpoolprice:   25,
						volume:            3,
						category:          4,
						trust:             0,
						tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
						apprestrict:       constants.NULL.ADDRESS,
						datasetrestrict:   constants.NULL.ADDRESS,
						requesterrestrict: constants.NULL.ADDRESS,
						salt:              web3.utils.randomHex(32),
						sign:              constants.NULL.SIGNATURE,
					});
				});

				it("verify", async () => {
					assert.isTrue(await IexecInstance.verifySignature(
						scheduler.address,
						odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder),
						workerpoolorder.sign
					));
				});
			});

			describe("request", async () => {
				it("sign", async () => {
					requestorder = await user.signRequestOrder({
						app:                AppInstance.address,
						appmaxprice:        3,
						dataset:            DatasetInstance.address,
						datasetmaxprice:    1,
						workerpool:         constants.NULL.ADDRESS,
						workerpoolmaxprice: 25,
						volume:             1, // CHANGE FOR BOT
						category:           4,
						trust:              0,
						tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
						requester:          user.address,
						beneficiary:        user.address,
						callback:           constants.NULL.ADDRESS,
						params:             "<parameters>",
						salt:               web3.utils.randomHex(32),
						sign:               constants.NULL.SIGNATURE,
					});
				});
				it("verify", async () => {
					assert.isTrue(await IexecInstance.verifySignature(
						user.address,
						odbtools.utils.hashRequestOrder(ERC712_domain, requestorder),
						requestorder.sign
					));
				});
			});
		});
	});

	describe("braodcasting", async () => {
		describe("broadcastAppOrder", async () => {
			it("success", async () => {
				txMined = await IexecInstance.broadcastAppOrder(apporder, { from: user.address });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "BroadcastAppOrder");
				assert.equal(events[0].args.apporder.app,                apporder.app               );
				assert.equal(events[0].args.apporder.appprice,           apporder.appprice          );
				assert.equal(events[0].args.apporder.volume,             apporder.volume            );
				assert.equal(events[0].args.apporder.datasetrestrict,    apporder.datasetrestrict   );
				assert.equal(events[0].args.apporder.workerpoolrestrict, apporder.workerpoolrestrict);
				assert.equal(events[0].args.apporder.requesterrestrict,  apporder.requesterrestrict );
				assert.equal(events[0].args.apporder.salt,               apporder.salt              );
				assert.equal(events[0].args.apporder.sign.v,             apporder.sign.v            );
				assert.equal(events[0].args.apporder.sign.r,             apporder.sign.r            );
				assert.equal(events[0].args.apporder.sign.s,             apporder.sign.s            );
			});
		});

		describe("broadcastDatasetOrder", async () => {
			it("success", async () => {
				txMined = await IexecInstance.broadcastDatasetOrder(datasetorder, { from: user.address });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "BroadcastDatasetOrder");
				assert.equal(events[0].args.datasetorder.dataset,            datasetorder.dataset           );
				assert.equal(events[0].args.datasetorder.datasetprice,       datasetorder.datasetprice      );
				assert.equal(events[0].args.datasetorder.volume,             datasetorder.volume            );
				assert.equal(events[0].args.datasetorder.apprestrict,        datasetorder.apprestrict       );
				assert.equal(events[0].args.datasetorder.workerpoolrestrict, datasetorder.workerpoolrestrict);
				assert.equal(events[0].args.datasetorder.requesterrestrict,  datasetorder.requesterrestrict );
				assert.equal(events[0].args.datasetorder.salt,               datasetorder.salt              );
				assert.equal(events[0].args.datasetorder.sign.v,             datasetorder.sign.v            );
				assert.equal(events[0].args.datasetorder.sign.r,             datasetorder.sign.r            );
				assert.equal(events[0].args.datasetorder.sign.s,             datasetorder.sign.s            );
			});
		});

		describe("broadcastWorkerpoolOrder", async () => {
			it("success", async () => {
				txMined = await IexecInstance.broadcastWorkerpoolOrder(workerpoolorder, { from: user.address });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "BroadcastWorkerpoolOrder");
				assert.equal(events[0].args.workerpoolorder.workerpool,        workerpoolorder.workerpool       );
				assert.equal(events[0].args.workerpoolorder.workerpoolprice,   workerpoolorder.workerpoolprice  );
				assert.equal(events[0].args.workerpoolorder.volume,            workerpoolorder.volume           );
				assert.equal(events[0].args.workerpoolorder.category,          workerpoolorder.category         );
				assert.equal(events[0].args.workerpoolorder.trust,             workerpoolorder.trust            );
				assert.equal(events[0].args.workerpoolorder.tag,               workerpoolorder.tag              );
				assert.equal(events[0].args.workerpoolorder.apprestrict,       workerpoolorder.apprestrict      );
				assert.equal(events[0].args.workerpoolorder.datasetrestrict,   workerpoolorder.datasetrestrict  );
				assert.equal(events[0].args.workerpoolorder.requesterrestrict, workerpoolorder.requesterrestrict);
				assert.equal(events[0].args.workerpoolorder.salt,              workerpoolorder.salt             );
				assert.equal(events[0].args.workerpoolorder.sign.v,            workerpoolorder.sign.v           );
				assert.equal(events[0].args.workerpoolorder.sign.r,            workerpoolorder.sign.r           );
				assert.equal(events[0].args.workerpoolorder.sign.s,            workerpoolorder.sign.s           );
			});
		});

		describe("broadcastRequestOrder", async () => {
			it("success", async () => {
				txMined = await IexecInstance.broadcastRequestOrder(requestorder, { from: user.address });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "BroadcastRequestOrder");
				assert.equal(events[0].args.requestorder.app,                requestorder.app               );
				assert.equal(events[0].args.requestorder.appmaxprice,        requestorder.appmaxprice       );
				assert.equal(events[0].args.requestorder.dataset,            requestorder.dataset           );
				assert.equal(events[0].args.requestorder.datasetmaxprice,    requestorder.datasetmaxprice   );
				assert.equal(events[0].args.requestorder.workerpool,         requestorder.workerpool        );
				assert.equal(events[0].args.requestorder.workerpoolmaxprice, requestorder.workerpoolmaxprice);
				assert.equal(events[0].args.requestorder.volume,             requestorder.volume            );
				assert.equal(events[0].args.requestorder.category,           requestorder.category          );
				assert.equal(events[0].args.requestorder.trust,              requestorder.trust             );
				assert.equal(events[0].args.requestorder.tag,                requestorder.tag               );
				assert.equal(events[0].args.requestorder.requester,          requestorder.requester         );
				assert.equal(events[0].args.requestorder.beneficiary,        requestorder.beneficiary       );
				assert.equal(events[0].args.requestorder.callback,           requestorder.callback          );
				assert.equal(events[0].args.requestorder.params,             requestorder.params            );
				assert.equal(events[0].args.requestorder.salt,               requestorder.salt              );
				assert.equal(events[0].args.requestorder.sign.v,             requestorder.sign.v            );
				assert.equal(events[0].args.requestorder.sign.r,             requestorder.sign.r            );
				assert.equal(events[0].args.requestorder.sign.s,             requestorder.sign.s            );
			});
		});
	});
});
