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

	var authorization = {};
	var secret        = {};
	var result        = {};
	var consensus     = null;
	var worker        = [];

	var gasReceipt = [];

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

		trusttarget = 0;
		worker = { agent: worker1, useenclave: true,  result: "iExec the wanderer" };
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
						assert.equal(await RLCInstance.owner(), iexecAdmin.address, "iexecAdmin should own the RLC smart contract");

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
		});

		describe("[3] contributeAndFinalize", async () => {
			it("authorization signature", async () => {
				const preauth             = await scheduler.signPreAuthorization(taskid, worker.agent.address);
				[ authorization, secret ] = worker.useenclave ? await broker.signAuthorization(preauth) : [ preauth, null ];

			});

			it("run", async () => {
				consensus = odbtools.utils.hashConsensus(taskid, consensus);
				result = await worker.agent.run(authorization, secret, worker.result);
			});

			it("[TX] contributeAndFinalize", async () => {
			txMined = await IexecInstance.contributeAndFinalize(
					authorization.taskid,            // task      (authorization)
					result.digest,                   // digest    (result)
					web3.utils.utf8ToHex("aResult"), // data      (result)
					"0x",                            // data      (callback)
					authorization.enclave,           // address   (enclave)
					result.sign,                     // signature (enclave)
					authorization.sign,              // signature (authorization)
					{ from: worker.agent.address }
				);
				gasReceipt.push([ "contributeAndFinalize", txMined.receipt.gasUsed ]);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskContribute");
				assert.equal(events[0].args.taskid, authorization.taskid);
				assert.equal(events[0].args.worker, worker.agent.address);
				assert.equal(events[0].args.hash,   result.hash         );

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskConsensus");
				assert.equal(events[0].args.taskid,    taskid        );
				assert.equal(events[0].args.consensus, consensus.hash);

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskReveal");
				assert.equal(events[0].args.taskid, taskid              );
				assert.equal(events[0].args.worker, worker.agent.address);
				assert.equal(events[0].args.digest, result.digest       );

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
				assert.equal(events[0].args.taskid,  taskid                         );
				assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"));
			});
		});
	});

	describe("→ summary", async () => {
		it("task", async () => {
			task = await IexecInstance.viewTask(taskid);
			assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                        );
			assert.equal    (       task.dealid,                   dealid                                                                    );
			assert.equal    (Number(task.idx),                     0                                                                         );
			assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
			assert.isAbove  (Number(task.contributionDeadline),    0                                                                         );
			assert.isAbove  (Number(task.revealDeadline),          0                                                                         );
			assert.isAbove  (Number(task.finalDeadline),           0                                                                         );
			assert.equal    (       task.consensusValue,           consensus.hash                                                            );
			assert.equal    (Number(task.revealCounter),           1                                                                         );
			assert.equal    (Number(task.winnerCounter),           1                                                                         );
			assert.deepEqual(       task.contributors.map(a => a), [ worker.agent.address ]                                                  );
			assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult")                                           );
			assert.equal    (       task.resultsCallback,          "0x"                                                                      );
		});

		it("balances", async () => {
			assert.deepEqual(await appProvider.viewAccount(),     [    3, 0 ], "check balance");
			assert.deepEqual(await datasetProvider.viewAccount(), [    1, 0 ], "check balance");
			assert.deepEqual(await scheduler.viewAccount(),       [ 1002, 0 ], "check balance");
			assert.deepEqual(await worker1.viewAccount(),         [ 1023, 0 ], "check balance");
			assert.deepEqual(await worker2.viewAccount(),         [ 1000, 0 ], "check balance");
			assert.deepEqual(await worker3.viewAccount(),         [ 1000, 0 ], "check balance");
			assert.deepEqual(await worker4.viewAccount(),         [ 1000, 0 ], "check balance");
			assert.deepEqual(await worker5.viewAccount(),         [ 1000, 0 ], "check balance");
			assert.deepEqual(await user.viewAccount(),            [  971, 0 ], "check balance");
		});

		it("balances - extra", async () => {
			assert.equal(
				Number(await IexecInstance.totalSupply()),
				DEPLOYMENT.asset == "Native"
					? Number(await web3.eth.getBalance(IexecInstance.address)) / 10 ** 9
					: Number(await RLCInstance.balanceOf(IexecInstance.address))
			);

			for (agent of [ appProvider, datasetProvider, scheduler, worker1, worker2, worker3, worker4, worker5, user ])
			{
				assert.deepEqual(await agent.viewAccount(), [ Number(await IexecInstance.balanceOf(agent.address)), Number(await IexecInstance.frozenOf(agent.address)) ], "check balance");
			}
		});

		it("score", async () => {
			assert.equal(await worker1.viewScore(), 0, "score issue");
			assert.equal(await worker2.viewScore(), 0, "score issue");
			assert.equal(await worker3.viewScore(), 0, "score issue");
			assert.equal(await worker4.viewScore(), 0, "score issue");
			assert.equal(await worker5.viewScore(), 0, "score issue");
		});

		it("gas used", async () => {
			totalgas = 0;
			for ([descr, gas] of gasReceipt)
			{
				console.log(`${descr.padEnd(24, " ")} ${gas.toString().padStart(8, " ")}`);
				totalgas += gas;
			}
			console.log(`${"Total gas".padEnd(24, " ")} ${totalgas.toString().padStart(8, " ")}`);
		});
	});

});
