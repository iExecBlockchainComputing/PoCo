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
var DEPLOYMENT         = require("../config/config.json").chains.default;
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
const tools     = require("../utils/tools");
const enstools  = require("../utils/ens-tools");
const odbtools  = require("../utils/odb-tools");
const constants = require("../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Fullchain', async (accounts) => {

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

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder        = null;
	var datasetorder    = null;
	var workerpoolorder = null;
	var requestorder    = null;

	var dealid      = null;
	var tasks       = null;
	var trusttarget = null;

	var gasReceipt = [];

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

		trusttarget = 4;
		tasks  = {
			0:
			{
				taskid:         null,
				authorizations: {},
				secrets:        {},
				results:        {},
				consensus:      "iExec BOT 0",
				workers :
				[
					{ agent: worker1, useenclave: false, result: "iExec BOT 0" },
					{ agent: worker2, useenclave: false, result: "iExec BOT 0" },
				]
			},
			1:
			{
				taskid:         null,
				authorizations: {},
				secrets:        {},
				results:        {},
				consensus:      "iExec BOT 1",
				workers :
				[
					{ agent: worker2, useenclave: true, result: "iExec BOT 1" },
					{ agent: worker3, useenclave: true, result: "iExec BOT 1" },
				]
			},
			2:
			{
				taskid:         null,
				authorizations: {},
				secrets:        {},
				results:        {},
				consensus:      "iExec BOT 2",
				workers :
				[
					{ agent: worker1, useenclave: false, result: "iExec BOT 2"       },
					{ agent: worker3, useenclave: false, result: "<timeout reached>" },
					{ agent: worker2, useenclave: true,  result: "iExec BOT 2"       },
					{ agent: worker4, useenclave: true,  result: "iExec BOT 2"       },
					{ agent: worker5, useenclave: true,  result: "iExec BOT 2"       },
				]
			},
		};
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
					workerpoolorder1 = await scheduler.signWorkerpoolOrder({
						workerpool:        WorkerpoolInstance.address,
						workerpoolprice:   15,
						volume:            2,
						category:          4,
						trust:             trusttarget,
						tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
						apprestrict:       constants.NULL.ADDRESS,
						datasetrestrict:   constants.NULL.ADDRESS,
						requesterrestrict: constants.NULL.ADDRESS,
						salt:              web3.utils.randomHex(32),
						sign:              constants.NULL.SIGNATURE,
					});

					workerpoolorder2 = await scheduler.signWorkerpoolOrder({
						workerpool:        WorkerpoolInstance.address,
						workerpoolprice:   25,
						volume:            10,
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
						odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder1),
						workerpoolorder1.sign
					));

					assert.isTrue(await IexecInstance.verifySignature(
						scheduler.address,
						odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder2),
						workerpoolorder2.sign
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
						volume:             3, // CHANGE FOR BOT
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
				txsMined = await Promise.all([
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder1, requestorder, { from: user.address }),
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder2, requestorder, { from: user.address }),
				]);
				gasReceipt.push([ "matchOrders", txsMined[0].receipt.gasUsed ]);
				gasReceipt.push([ "matchOrders", txsMined[1].receipt.gasUsed ]);

				deal0 = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.utils.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 0                                                            },
				);
				deal1 = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.utils.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 2                                                            },
				);

				events = tools.extractEvents(txsMined[0], IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     deal0                     );

				events = tools.extractEvents(txsMined[1], IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     deal1                     );

				events = tools.extractEvents(txsMined[0], IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.dealid,         deal0                                                              );
				assert.equal(events[0].args.appHash,        odbtools.utils.hashAppOrder       (ERC712_domain, apporder        ));
				assert.equal(events[0].args.datasetHash,    odbtools.utils.hashDatasetOrder   (ERC712_domain, datasetorder    ));
				assert.equal(events[0].args.workerpoolHash, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder1));
				assert.equal(events[0].args.requestHash,    odbtools.utils.hashRequestOrder   (ERC712_domain, requestorder    ));
				assert.equal(events[0].args.volume,         2                                                                  );

				events = tools.extractEvents(txsMined[1], IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.dealid,         deal1                                                              );
				assert.equal(events[0].args.appHash,        odbtools.utils.hashAppOrder       (ERC712_domain, apporder        ));
				assert.equal(events[0].args.datasetHash,    odbtools.utils.hashDatasetOrder   (ERC712_domain, datasetorder    ));
				assert.equal(events[0].args.workerpoolHash, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder2));
				assert.equal(events[0].args.requestHash,    odbtools.utils.hashRequestOrder   (ERC712_domain, requestorder    ));
				assert.equal(events[0].args.volume,         1                                                                  );

				dealids = await odbtools.utils.requestToDeal(IexecInstance, odbtools.utils.hashRequestOrder(ERC712_domain, requestorder));
				assert.equal(dealids[0], deal0);
				assert.equal(dealids[1], deal1);
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize task", async () => {
				txMined = await IexecInstance.initialize(dealids[0], 0, { from: scheduler.address });
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				tasks[0].taskid = events[0].args.taskid;

				txMined = await IexecInstance.initialize(dealids[0], 1, { from: scheduler.address });
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				tasks[1].taskid = events[0].args.taskid;

				txMined = await IexecInstance.initialize(dealids[1], 2, { from: scheduler.address });
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				tasks[2].taskid = events[0].args.taskid;
			});
		});

		describe("[3] contribute", async () => {
			it("authorization signature", async () => {
				for (i in tasks)
				for (w of tasks[i].workers)
				{
					const preauth                            = await scheduler.signPreAuthorization(tasks[i].taskid, w.agent.address);
					const [ auth, secret ]                   = w.useenclave ? await broker.signAuthorization(preauth) : [ preauth, null ];
					tasks[i].authorizations[w.agent.address] = auth;
					tasks[i].secrets[w.agent.address]        = secret;
				}
			});

			it("run", async () => {
				for (i in tasks)
				{
					tasks[i].consensus = odbtools.utils.hashConsensus(tasks[i].taskid, tasks[i].consensus);
					for (w of tasks[i].workers)
					{
						tasks[i].results[w.agent.address] = await w.agent.run(tasks[i].authorizations[w.agent.address], tasks[i].secrets[w.agent.address], w.result);
					}
				}
			});

			it("[TX] contribute", async () => {
				for (i in tasks)
				for (w of tasks[i].workers)
				{
					txMined = await IexecInstance.contribute(
						tasks[i].authorizations[w.agent.address].taskid,  // task (authorization)
						tasks[i].results       [w.agent.address].hash,    // common    (result)
						tasks[i].results       [w.agent.address].seal,    // unique    (result)
						tasks[i].authorizations[w.agent.address].enclave, // address   (enclave)
						tasks[i].results       [w.agent.address].sign,    // signature (enclave)
						tasks[i].authorizations[w.agent.address].sign,    // signature (authorization)
						{ from: w.agent.address }
					);
					gasReceipt.push([ "contribute", txMined.receipt.gasUsed ]);
				}
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				for (i in tasks)
				for (w of tasks[i].workers)
				if (tasks[i].results[w.agent.address].hash == tasks[i].consensus.hash)
				{
					txMined = await IexecInstance.reveal(
						tasks[i].authorizations[w.agent.address].taskid,
						tasks[i].results[w.agent.address].digest,
						{ from: w.agent.address }
					);
					gasReceipt.push([ "reveal", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskReveal");
					assert.equal(events[0].args.taskid, tasks[i].authorizations[w.agent.address].taskid);
					assert.equal(events[0].args.worker, w.agent.address                                );
					assert.equal(events[0].args.digest, tasks[i].results[w.agent.address].digest       );
				}
			});
		});

		describe("[5] finalization", async () => {

			describe("task 1", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[0].taskid,
						web3.utils.utf8ToHex("aResult 1"),
						"0x",
						{ from: scheduler.address }
					);
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[0].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"));
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[0].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                        );
						assert.equal    (       task.dealid,                   dealids[0]                                                                );
						assert.equal    (Number(task.idx),                     0                                                                         );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                         );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                         );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                         );
						assert.equal    (       task.consensusValue,           tasks[0].consensus.hash                                                   );
						assert.equal    (Number(task.revealCounter),           2                                                                         );
						assert.equal    (Number(task.winnerCounter),           2                                                                         );
						assert.deepEqual(       task.contributors.map(a => a), tasks[0].workers.map(w => w.agent.address)                                );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 1")                                         );
						assert.equal    (       task.resultsCallback,          "0x"                                                                      );
					});

					it("balances", async () => {
						assert.deepEqual(await appProvider.viewAccount(),     [    0 +  3 +  0 +  0, 0           ], "check balance");
						assert.deepEqual(await datasetProvider.viewAccount(), [    0 +  1 +  0 +  0, 0           ], "check balance");
						assert.deepEqual(await scheduler.viewAccount(),       [ 1000 +  1 -  4 -  7, 0 +  4 +  7 ], "check balance");
						assert.deepEqual(await worker1.viewAccount(),         [ 1000 +  7      -  8, 0      +  8 ], "check balance");
						assert.deepEqual(await worker2.viewAccount(),         [ 1000 +  7 -  5 -  8, 0 +  5 +  8 ], "check balance");
						assert.deepEqual(await worker3.viewAccount(),         [ 1000      -  5 -  8, 0 +  5 +  8 ], "check balance");
						assert.deepEqual(await worker4.viewAccount(),         [ 1000           -  8, 0      +  8 ], "check balance");
						assert.deepEqual(await worker5.viewAccount(),         [ 1000           -  8, 0      +  8 ], "check balance");
						assert.deepEqual(await user.viewAccount(),            [ 1000 - 19 - 19 - 29, 0 + 19 + 29 ], "check balance");
					});

					it("score", async () => {
						assert.equal(await worker1.viewScore(), 1, "score issue");
						assert.equal(await worker2.viewScore(), 1, "score issue");
						assert.equal(await worker3.viewScore(), 0, "score issue");
						assert.equal(await worker4.viewScore(), 0, "score issue");
						assert.equal(await worker5.viewScore(), 0, "score issue");
					});
				});
			});

			describe("task 2", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[1].taskid,
						web3.utils.utf8ToHex("aResult 2"),
						"0x",
						{ from: scheduler.address }
					);
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[1].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"));
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[1].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                        );
						assert.equal    (       task.dealid,                   dealids[0]                                                                );
						assert.equal    (Number(task.idx),                     1                                                                         );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                         );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                         );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                         );
						assert.equal    (       task.consensusValue,           tasks[1].consensus.hash                                                   );
						assert.equal    (Number(task.revealCounter),           2                                                                         );
						assert.equal    (Number(task.winnerCounter),           2                                                                         );
						assert.deepEqual(       task.contributors.map(a => a), tasks[1].workers.map(w => w.agent.address)                                );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 2")                                         );
						assert.equal    (       task.resultsCallback,          "0x"                                                                      );
					});

					it("balances", async () => {
						assert.deepEqual(await appProvider.viewAccount(),     [    0 +  3 +  3 +  0, 0      ], "check balance");
						assert.deepEqual(await datasetProvider.viewAccount(), [    0 +  1 +  1 +  0, 0      ], "check balance");
						assert.deepEqual(await scheduler.viewAccount(),       [ 1000 +  1 +  1 -  7, 0 +  7 ], "check balance");
						assert.deepEqual(await worker1.viewAccount(),         [ 1000 +  7      -  8, 0 +  8 ], "check balance");
						assert.deepEqual(await worker2.viewAccount(),         [ 1000 +  7 +  7 -  8, 0 +  8 ], "check balance");
						assert.deepEqual(await worker3.viewAccount(),         [ 1000      +  7 -  8, 0 +  8 ], "check balance");
						assert.deepEqual(await worker4.viewAccount(),         [ 1000           -  8, 0 +  8 ], "check balance");
						assert.deepEqual(await worker5.viewAccount(),         [ 1000           -  8, 0 +  8 ], "check balance");
						assert.deepEqual(await user.viewAccount(),            [ 1000 - 19 - 19 - 29, 0 + 29 ], "check balance");
					});

					it("score", async () => {
						assert.equal(await worker1.viewScore(), 1, "score issue");
						assert.equal(await worker2.viewScore(), 2, "score issue");
						assert.equal(await worker3.viewScore(), 1, "score issue");
						assert.equal(await worker4.viewScore(), 0, "score issue");
						assert.equal(await worker5.viewScore(), 0, "score issue");
					});
				});
			});

			describe("task 3", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[2].taskid,
						web3.utils.utf8ToHex("aResult 3"),
						"0x",
						{ from: scheduler.address }
					);
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[2].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 3"));
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[2].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                        );
						assert.equal    (       task.dealid,                   dealids[1]                                                                );
						assert.equal    (Number(task.idx),                     2                                                                         );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                         );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                         );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                         );
						assert.equal    (       task.consensusValue,           tasks[2].consensus.hash                                                   );
						assert.equal    (Number(task.revealCounter),           4                                                                         );
						assert.equal    (Number(task.winnerCounter),           4                                                                         );
						assert.deepEqual(       task.contributors.map(a => a), tasks[2].workers.map(w => w.agent.address)                                );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 3")                                         );
						assert.equal    (       task.resultsCallback,          "0x"                                                                      );
					});

					it("balances", async () => {
						assert.deepEqual(await appProvider.viewAccount(),     [    0 +  3 +  3 +  3, 0 ], "check balance");
						assert.deepEqual(await datasetProvider.viewAccount(), [    0 +  1 +  1 +  1, 0 ], "check balance");
						assert.deepEqual(await scheduler.viewAccount(),       [ 1000 +  1 +  1 +  5, 0 ], "check balance");
						assert.deepEqual(await worker1.viewAccount(),         [ 1000 +  7      +  7, 0 ], "check balance");
						assert.deepEqual(await worker2.viewAccount(),         [ 1000 +  7 +  7 +  7, 0 ], "check balance");
						assert.deepEqual(await worker3.viewAccount(),         [ 1000      +  7 -  8, 0 ], "check balance");
						assert.deepEqual(await worker4.viewAccount(),         [ 1000           +  7, 0 ], "check balance");
						assert.deepEqual(await worker5.viewAccount(),         [ 1000           +  7, 0 ], "check balance");
						assert.deepEqual(await user.viewAccount(),            [ 1000 - 19 - 19 - 29, 0 ], "check balance");
					});

					it("score", async () => {
						assert.equal(await worker1.viewScore(), 2, "score issue");
						assert.equal(await worker2.viewScore(), 3, "score issue");
						assert.equal(await worker3.viewScore(), 0, "score issue");
						assert.equal(await worker4.viewScore(), 1, "score issue");
						assert.equal(await worker5.viewScore(), 1, "score issue");
					});
				});
			});

		});
	});

	describe("→ summary", async () => {
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
