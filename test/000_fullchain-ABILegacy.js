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
var DEPLOYMENT              = require("../config/config.json").chains.default;
// Artefacts
var RLC                     = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy            = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterfaceABILegacy = artifacts.require(`IexecInterface${DEPLOYMENT.asset}ABILegacy`);
var AppRegistry             = artifacts.require("AppRegistry");
var DatasetRegistry         = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry      = artifacts.require("WorkerpoolRegistry");
var App                     = artifacts.require("App");
var Dataset                 = artifacts.require("Dataset");
var Workerpool              = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../utils/tools");
const enstools  = require("../utils/ens-tools");
const odbtools  = require("../utils/odb-tools");
const constants = require("../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Fullchain', async (accounts) => {

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
	var dealid          = null;
	var taskid          = null;

	var authorizations = {};
	var secrets        = {};
	var results        = {};
	var consensus      = null;
	var workers        = [];

	var gasReceipt = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		IexecInstance              = await IexecInterfaceABILegacy.at((await ERC1538Proxy.deployed()).address);
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

		trusttarget = 4;
		workers = [
			{ agent: worker1, useenclave: true,  result: "iExec the wanderer" },
			{ agent: worker2, useenclave: false, result: "iExec the wanderer" },
		];
		consensus = "iExec the wanderer";
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   appProvider.address);
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   datasetProvider.address);
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   scheduler.address);
					WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));
				});

				it("change policy", async () => {
					txMined = await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler.address });
					events = tools.extractEvents(txMined, WorkerpoolInstance.address, "PolicyUpdate");
					assert.equal(events[0].args.oldWorkerStakeRatioPolicy,     30);
					assert.equal(events[0].args.newWorkerStakeRatioPolicy,     35);
					assert.equal(events[0].args.oldSchedulerRewardRatioPolicy,  1);
					assert.equal(events[0].args.newSchedulerRewardRatioPolicy,  5);
				});
			});
		});

		describe("tokens", async () => {
			it("balances before", async () => {
				assert.deepEqual(await appProvider.viewAccount(),     [ 0, 0 ], "check balance");
				assert.deepEqual(await datasetProvider.viewAccount(), [ 0, 0 ], "check balance");
				assert.deepEqual(await scheduler.viewAccount(),       [ 0, 0 ], "check balance");
				assert.deepEqual(await worker1.viewAccount(),         [ 0, 0 ], "check balance");
				assert.deepEqual(await worker2.viewAccount(),         [ 0, 0 ], "check balance");
				assert.deepEqual(await worker3.viewAccount(),         [ 0, 0 ], "check balance");
				assert.deepEqual(await worker4.viewAccount(),         [ 0, 0 ], "check balance");
				assert.deepEqual(await worker5.viewAccount(),         [ 0, 0 ], "check balance");
				assert.deepEqual(await user.viewAccount(),            [ 0, 0 ], "check balance");
			});

			it("deposit", async () => {
				switch (DEPLOYMENT.asset)
				{
					case "Native":
						txMined = await IexecInstance.deposit({ from: iexecAdmin.address, value: 10000000 * 10 ** 9 });
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.from,    constants.NULL.ADDRESS);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.to,      iexecAdmin.address);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.value,   10000000);
						break;

					case "Token":
						txMined = await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin.address });
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.owner,   iexecAdmin.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.spender, IexecInstance.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.value,   10000000);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.from,    iexecAdmin.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.to,      IexecInstance.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.value,   10000000);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.from,    constants.NULL.ADDRESS);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.to,      iexecAdmin.address);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.value,   10000000);
						break;
				}

				txsMined = await Promise.all([
					IexecInstance.transfer(scheduler.address, 1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker1.address,   1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker2.address,   1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker3.address,   1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker4.address,   1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker5.address,   1000, { from: iexecAdmin.address }),
					IexecInstance.transfer(user.address,      1000, { from: iexecAdmin.address }),
				]);

				assert.equal(tools.extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin.address);
				assert.equal(tools.extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.value, 1000);
			});

			it("balances after", async () => {
				assert.deepEqual(await appProvider.viewAccount(),     [    0, 0 ], "check balance");
				assert.deepEqual(await datasetProvider.viewAccount(), [    0, 0 ], "check balance");
				assert.deepEqual(await scheduler.viewAccount(),       [ 1000, 0 ], "check balance");
				assert.deepEqual(await worker1.viewAccount(),         [ 1000, 0 ], "check balance");
				assert.deepEqual(await worker2.viewAccount(),         [ 1000, 0 ], "check balance");
				assert.deepEqual(await worker3.viewAccount(),         [ 1000, 0 ], "check balance");
				assert.deepEqual(await worker4.viewAccount(),         [ 1000, 0 ], "check balance");
				assert.deepEqual(await worker5.viewAccount(),         [ 1000, 0 ], "check balance");
				assert.deepEqual(await user.viewAccount(),            [ 1000, 0 ], "check balance");
			});
		});

		it("score", async () => {
			assert.equal(await worker1.viewScore(), 0, "score issue");
			assert.equal(await worker2.viewScore(), 0, "score issue");
			assert.equal(await worker3.viewScore(), 0, "score issue");
			assert.equal(await worker4.viewScore(), 0, "score issue");
			assert.equal(await worker5.viewScore(), 0, "score issue");
		});
	});

	describe("→ pipeline", async () => {

		describe("[0] orders", async () => {
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
						trust:             trusttarget,
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
						trust:              trusttarget,
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

		describe("[1] order matching", async () => {
			it("[TX] match", async () => {
				txMined = await IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user.address });
				gasReceipt.push([ "matchOrders", txMined.receipt.gasUsed ]);

				dealid = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.utils.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 0                                                            },
				);

				events = tools.extractEvents(txMined, IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     dealid                    );

				events = tools.extractEvents(txMined, IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.dealid,         dealid                                                            );
				assert.equal(events[0].args.appHash,        odbtools.utils.hashAppOrder       (ERC712_domain, apporder       ));
				assert.equal(events[0].args.datasetHash,    odbtools.utils.hashDatasetOrder   (ERC712_domain, datasetorder   ));
				assert.equal(events[0].args.workerpoolHash, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder));
				assert.equal(events[0].args.requestHash,    odbtools.utils.hashRequestOrder   (ERC712_domain, requestorder   ));
				assert.equal(events[0].args.volume,         1                                                                 );
			});

			describe("checks", async () => {
				it("deal", async () => {
					deal_pt1 = await IexecInstance.viewDealABILegacy_pt1(dealid);
					assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , AppInstance.address,             "check deal (deal.dapp.pointer)");
					assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , requestorder.app,                "check deal (deal.dapp.pointer)");
					assert.equal    (deal_pt1[1]            /*dapp.owner*/   , appProvider.address,             "check deal (deal.dapp.owner)"  );
					assert.equal    (deal_pt1[2].toNumber() /*dapp.price*/   , apporder.appprice,               "check deal (deal.dapp.price)"  );
					assert.isAtMost (deal_pt1[2].toNumber() /*dapp.price*/   , requestorder.appmaxprice,        "check deal (deal.dapp.price)"  );

					assert.equal    (deal_pt1[3]            /*data.pointer*/ , DatasetInstance.address,         "check deal (deal.data.pointer)");
					assert.equal    (deal_pt1[3]            /*data.pointer*/ , requestorder.dataset,            "check deal (deal.data.pointer)");
					assert.equal    (deal_pt1[4]            /*data.owner*/   , datasetProvider.address,         "check deal (deal.data.owner)"  );
					assert.equal    (deal_pt1[5].toNumber() /*data.price*/   , datasetorder.datasetprice,       "check deal (deal.data.price)"  );
					assert.isAtMost (deal_pt1[5].toNumber() /*data.price*/   , requestorder.datasetmaxprice,    "check deal (deal.data.price)"  );

					assert.equal    (deal_pt1[6]            /*pool.pointer*/ , WorkerpoolInstance.address,      "check deal (deal.pool.pointer)");
					if (requestorder.workerpool != constants.NULL.ADDRESS)
					assert.equal    (deal_pt1[6]            /*pool.pointer*/ , requestorder.workerpool,         "check deal (deal.pool.pointer)");
					assert.equal    (deal_pt1[7]            /*pool.owner*/   , scheduler.address,               "check deal (deal.pool.owner)"  );
					assert.equal    (deal_pt1[8].toNumber() /*pool.price*/   , workerpoolorder.workerpoolprice, "check deal (deal.pool.price)"  );
					assert.isAtMost (deal_pt1[8].toNumber() /*pool.price*/   , requestorder.workerpoolmaxprice, "check deal (deal.pool.price)"  );

					deal_pt2 = await IexecInstance.viewDealABILegacy_pt2(dealid);
					assert.equal    (deal_pt2[0].toNumber(),                   workerpoolorder.trust,           "check deal (deal.trust)"      );
					assert.isAtLeast(deal_pt2[0].toNumber(),                   requestorder.trust,              "check deal (deal.trust)"      );
					assert.equal    (deal_pt2[1],                              workerpoolorder.tag,             "check deal (deal.tag)"        );
					assert.equal    (deal_pt2[1],                              requestorder.tag,                "check deal (deal.tag)"        );
					assert.equal    (deal_pt2[2],                              user.address,                    "check deal (deal.requester)"  );
					assert.equal    (deal_pt2[3],                              user.address,                    "check deal (deal.beneficiary)");
					assert.equal    (deal_pt2[4],                              requestorder.callback,           "check deal (deal.callback)"   );
					assert.equal    (deal_pt2[5],                              requestorder.params,             "check deal (deal.params)"     );
				});

				it("config", async () => {
					config = await IexecInstance.viewConfigABILegacy(dealid);
					assert.equal  (config[0].toNumber(), workerpoolorder.category, "check config (config.category)"            );
					assert.equal  (config[0].toNumber(), requestorder.category,    "check config (config.category)"            );
					assert.isAbove(config[1].toNumber(), 0,                        "check config (config.start)"               );
					assert.equal  (config[2].toNumber(), 0,                        "check config (config.botFirst)"            );
					assert.equal  (config[3].toNumber(), 1,                        "check config (config.botSize)"             );
					assert.equal  (config[4].toNumber(), 8,                        "check config (config.workerStake)"         ); // 8 = floor(25*.3)
					assert.equal  (config[5].toNumber(), 5,                        "check config (config.schedulerRewardRatio)");
				});

				it("balances", async () => {
					assert.deepEqual(await appProvider.viewAccount(),     [    0,  0 ], "check balance");
					assert.deepEqual(await datasetProvider.viewAccount(), [    0,  0 ], "check balance");
					assert.deepEqual(await scheduler.viewAccount(),       [  993,  7 ], "check balance");
					assert.deepEqual(await worker1.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker2.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await user.viewAccount(),            [  971, 29 ], "check balance");
				});
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize", async () => {
				txMined = await IexecInstance.initialize(dealid, 0, { from: scheduler.address });
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);

				taskid = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.taskid,     taskid                    );
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTaskABILegacy(taskid);
					assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.ACTIVE                                      );
					assert.equal    (task[ 1],            dealid                                                               );
					assert.equal    (task[ 2].toNumber(), 0                                                                    );
					assert.equal    (task[ 3].toNumber(), (await IexecInstance.viewCategoryABILegacy(requestorder.category))[2]);
					assert.isAbove  (task[ 4].toNumber(), 0                                                                    );
					assert.equal    (task[ 5].toNumber(), 0                                                                    );
					assert.isAbove  (task[ 6].toNumber(), 0                                                                    );
					assert.equal    (task[ 7],            constants.NULL.BYTES32                                               );
					assert.equal    (task[ 8].toNumber(), 0                                                                    );
					assert.equal    (task[ 9].toNumber(), 0                                                                    );
					assert.deepEqual(task[10],            []                                                                   );
					assert.equal    (task[11],            null                                                                 );
				});

				it("balances", async () => {
					assert.deepEqual(await appProvider.viewAccount(),     [    0,  0 ], "check balance");
					assert.deepEqual(await datasetProvider.viewAccount(), [    0,  0 ], "check balance");
					assert.deepEqual(await scheduler.viewAccount(),       [  993,  7 ], "check balance");
					assert.deepEqual(await worker1.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker2.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await user.viewAccount(),            [  971, 29 ], "check balance");
				});
			});
		});

		describe("[3] contribute", async () => {
			it("authorization signature", async () => {
				for (w of workers)
				{
					const preauth                   = await scheduler.signPreAuthorization(taskid, w.agent.address);
					const [ auth, secret ]          = w.useenclave ? await broker.signAuthorization(preauth) : [ preauth, null ];
					authorizations[w.agent.address] = auth;
					secrets[w.agent.address]        = secret;
				}
			});

			it("run", async () => {
				consensus = odbtools.utils.hashConsensus(taskid, consensus);
				for (w of workers)
				{
					results[w.agent.address] = await w.agent.run(authorizations[w.agent.address], secrets[w.agent.address], w.result);
				}
			});

			it("[TX] contribute", async () => {
				for (w of workers)
				{
					txMined = await IexecInstance.contribute(
						authorizations[w.agent.address].taskid,  // task (authorization)
						results       [w.agent.address].hash,    // common    (result)
						results       [w.agent.address].seal,    // unique    (result)
						authorizations[w.agent.address].enclave, // address   (enclave)
						results       [w.agent.address].sign,    // signature (enclave)
						authorizations[w.agent.address].sign,    // signature (authorization)
						{ from: w.agent.address }
					);
					gasReceipt.push([ "contribute", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskContribute");
					assert.equal(events[0].args.taskid, authorizations[w.agent.address].taskid);
					assert.equal(events[0].args.worker, w.agent.address                       );
					assert.equal(events[0].args.hash,   results[w.agent.address].hash         );
				}
			});
			describe("checks", async () => {
				it("contribution", async () => {
					for (w of workers)
					{
						contribution = await IexecInstance.viewContributionABILegacy(taskid, w.agent.address);
						assert.equal(contribution[0], constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
						assert.equal(contribution[1], results[w.agent.address].hash,                "check contribution (contribution.resultHash)"      );
						assert.equal(contribution[2], results[w.agent.address].seal,                "check contribution (contribution.resultSeal)"      );
						assert.equal(contribution[3], authorizations[w.agent.address].enclave,      "check contribution (contribution.enclaveChallenge)");
					}
				});
			});

			it("task", async () => {
				task = await IexecInstance.viewTaskABILegacy(taskid);
				assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.REVEALING                                   );
				assert.equal    (task[ 1],            dealid                                                               );
				assert.equal    (task[ 2].toNumber(), 0                                                                    );
				assert.equal    (task[ 3].toNumber(), (await IexecInstance.viewCategoryABILegacy(requestorder.category))[2]);
				assert.isAbove  (task[ 4].toNumber(), 0                                                                    );
				assert.isAbove  (task[ 5].toNumber(), 0                                                                    );
				assert.isAbove  (task[ 6].toNumber(), 0                                                                    );
				assert.equal    (task[ 7],            consensus.hash                                                       );
				assert.equal    (task[ 8].toNumber(), 0                                                                    );
				assert.equal    (task[ 9].toNumber(), workers.length                                                       );
				assert.deepEqual(task[10],            workers.map(w => w.agent.address)                                    );
				assert.equal    (task[11],            null                                                                 );
			});

			it("balances", async () => {
				assert.deepEqual(await appProvider.viewAccount(),     [    0,  0 ], "check balance");
				assert.deepEqual(await datasetProvider.viewAccount(), [    0,  0 ], "check balance");
				assert.deepEqual(await scheduler.viewAccount(),       [  993,  7 ], "check balance");
				assert.deepEqual(await worker1.viewAccount(),         [  992,  8 ], "check balance");
				assert.deepEqual(await worker2.viewAccount(),         [  992,  8 ], "check balance");
				assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
				assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
				assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
				assert.deepEqual(await user.viewAccount(),            [  971, 29 ], "check balance");
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				for (w of workers)
				if (results[w.agent.address].hash == consensus.hash)
				{
					txMined = await IexecInstance.reveal(
						taskid,
						results[w.agent.address].digest,
						{ from: w.agent.address }
					);
					gasReceipt.push([ "reveal", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskReveal");
					assert.equal(events[0].args.taskid, taskid                         );
					assert.equal(events[0].args.worker, w.agent.address                );
					assert.equal(events[0].args.digest, results[w.agent.address].digest);
				}
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTaskABILegacy(taskid);
					assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.REVEALING                                   );
					assert.equal    (task[ 1],            dealid                                                               );
					assert.equal    (task[ 2].toNumber(), 0                                                                    );
					assert.equal    (task[ 3].toNumber(), (await IexecInstance.viewCategoryABILegacy(requestorder.category))[2]);
					assert.isAbove  (task[ 4].toNumber(), 0                                                                    );
					assert.isAbove  (task[ 5].toNumber(), 0                                                                    );
					assert.isAbove  (task[ 6].toNumber(), 0                                                                    );
					assert.equal    (task[ 7],            consensus.hash                                                       );
					assert.equal    (task[ 8].toNumber(), workers.length                                                       );
					assert.equal    (task[ 9].toNumber(), workers.length                                                       );
					assert.deepEqual(task[10],            workers.map(w => w.agent.address)                                    );
					assert.equal    (task[11],            null                                                                 );
				});

				it("balances", async () => {
					assert.deepEqual(await appProvider.viewAccount(),     [    0,  0 ], "check balance");
					assert.deepEqual(await datasetProvider.viewAccount(), [    0,  0 ], "check balance");
					assert.deepEqual(await scheduler.viewAccount(),       [  993,  7 ], "check balance");
					assert.deepEqual(await worker1.viewAccount(),         [  992,  8 ], "check balance");
					assert.deepEqual(await worker2.viewAccount(),         [  992,  8 ], "check balance");
					assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await user.viewAccount(),            [  971, 29 ], "check balance");
				});
			});
		});

		describe("[5] finalization", async () => {
			it("[TX] finalize", async () => {
				txMined = await IexecInstance.finalize(
					taskid,
					web3.utils.utf8ToHex("aResult"),
					"0x",
					{ from: scheduler.address }
				);
				gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
				assert.equal(events[0].args.taskid,  taskid                         );
				assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"));

				// TODO: check 2 events by w.address for w in workers
				// How to retreive events from the IexecClerk (5 rewards and 1 seize)
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTaskABILegacy(taskid);
					assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.COMPLETED                                   );
					assert.equal    (task[ 1],            dealid                                                               );
					assert.equal    (task[ 2].toNumber(), 0                                                                    );
					assert.equal    (task[ 3].toNumber(), (await IexecInstance.viewCategoryABILegacy(requestorder.category))[2]);
					assert.isAbove  (task[ 4].toNumber(), 0                                                                    );
					assert.isAbove  (task[ 5].toNumber(), 0                                                                    );
					assert.isAbove  (task[ 6].toNumber(), 0                                                                    );
					assert.equal    (task[ 7],            consensus.hash                                                       );
					assert.equal    (task[ 8].toNumber(), workers.length                                                       );
					assert.equal    (task[ 9].toNumber(), workers.length                                                       );
					assert.deepEqual(task[10],            workers.map(w => w.agent.address)                                    );
					assert.equal    (task[11],            web3.utils.utf8ToHex("aResult")                                      );
				});

				it("balances", async () => {
					assert.deepEqual(await appProvider.viewAccount(),     [    3,  0 ], "check balance");
					assert.deepEqual(await datasetProvider.viewAccount(), [    1,  0 ], "check balance");
					assert.deepEqual(await scheduler.viewAccount(),       [ 1003,  0 ], "check balance");
					assert.deepEqual(await worker1.viewAccount(),         [ 1011,  0 ], "check balance");
					assert.deepEqual(await worker2.viewAccount(),         [ 1011,  0 ], "check balance");
					assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
					assert.deepEqual(await user.viewAccount(),            [  971,  0 ], "check balance");
				});
			});
		});
	});

	describe("→ summary", async () => {
		it("balances", async () => {
			assert.deepEqual(await appProvider.viewAccount(),     [    3,  0 ], "check balance");
			assert.deepEqual(await datasetProvider.viewAccount(), [    1,  0 ], "check balance");
			assert.deepEqual(await scheduler.viewAccount(),       [ 1003,  0 ], "check balance");
			assert.deepEqual(await worker1.viewAccount(),         [ 1011,  0 ], "check balance");
			assert.deepEqual(await worker2.viewAccount(),         [ 1011,  0 ], "check balance");
			assert.deepEqual(await worker3.viewAccount(),         [ 1000,  0 ], "check balance");
			assert.deepEqual(await worker4.viewAccount(),         [ 1000,  0 ], "check balance");
			assert.deepEqual(await worker5.viewAccount(),         [ 1000,  0 ], "check balance");
			assert.deepEqual(await user.viewAccount(),            [  971,  0 ], "check balance");
		});

		it("balances - extra", async () => {
			assert.equal(
				Number(await IexecInstance.totalSupply()),
				DEPLOYMENT.asset == "Native"
					? Number(await web3.eth.getBalance(IexecInstance.address)) / 10 ** 9
					: Number(await RLCInstance.balanceOf(IexecInstance.address))
			);

			for (agent of [ datasetProvider, appProvider, scheduler, worker1, worker2, worker3, worker4, worker5, user ])
			{
				assert.deepEqual(await agent.viewAccount(), [ Number(await IexecInstance.balanceOf(agent.address)), Number(await IexecInstance.frozenOf(agent.address)) ], "check balance");
			}
		});

		it("score", async () => {
			assert.equal(await worker1.viewScore(), 1, "score issue");
			assert.equal(await worker2.viewScore(), 1, "score issue");
			assert.equal(await worker3.viewScore(), 0, "score issue");
			assert.equal(await worker4.viewScore(), 0, "score issue");
			assert.equal(await worker5.viewScore(), 0, "score issue");
		});

		it("gas used", async () => {
			totalgas = 0;
			for ([descr, gas] of gasReceipt)
			{
				console.log(`${descr.padEnd(20, " ")} ${gas.toString().padStart(8, " ")}`);
				totalgas += gas;
			}
			console.log(`${"Total gas".padEnd(20, " ")} ${totalgas.toString().padStart(8, " ")}`);
		});
	});

});
