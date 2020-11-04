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

contract('Poco', async (accounts) => {

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

	var apporder         = null;
	var datasetorder     = null;
	var workerpoolorder1 = null;
	var workerpoolorder2 = null;
	var requestorder     = null;

	var deals = {}
	var tasks = {};

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

	function sendContribution(taskid, worker, results, authorization, enclave)
	{
		return IexecInstance.contribute(
				taskid,                                                 // task (authorization)
				results.hash,                                           // common    (result)
				results.seal,                                           // unique    (result)
				enclave,                                                // address   (enclave)
				results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
				authorization.sign,                                     // signature (authorization)
				{ from: worker.address }
			);
	}

	describe("→ setup", async () => {
		describe("tokens", async () => {
			it("distribute", async () => {
				switch (DEPLOYMENT.asset)
				{
					case "Native":
						txMined = await IexecInstance.deposit({ from: iexecAdmin.address, value: 10000000 * 10 ** 9 });
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						break;

					case "Token":
						txMined = await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin.address });
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						break;
				}

				await Promise.all([
					IexecInstance.transfer(scheduler.address, 100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker1.address,   100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker2.address,   100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker3.address,   100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker4.address,   100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(worker5.address,   100000, { from: iexecAdmin.address }),
					IexecInstance.transfer(user.address,      100000, { from: iexecAdmin.address }),
				]);
			});

			it("balances", async () => {
				assert.deepEqual(await appProvider.viewAccount(),     [      0, 0 ], "check balance");
				assert.deepEqual(await datasetProvider.viewAccount(), [      0, 0 ], "check balance");
				assert.deepEqual(await scheduler.viewAccount(),       [ 100000, 0 ], "check balance");
				assert.deepEqual(await worker1.viewAccount(),         [ 100000, 0 ], "check balance");
				assert.deepEqual(await worker2.viewAccount(),         [ 100000, 0 ], "check balance");
				assert.deepEqual(await worker3.viewAccount(),         [ 100000, 0 ], "check balance");
				assert.deepEqual(await worker4.viewAccount(),         [ 100000, 0 ], "check balance");
				assert.deepEqual(await worker5.viewAccount(),         [ 100000, 0 ], "check balance");
				assert.deepEqual(await user.viewAccount(),            [ 100000, 0 ], "check balance");
			})
		});

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
			it("app", async () => {
				apporder = await appProvider.signAppOrder({
					app:                AppInstance.address,
					appprice:           0,
					volume:             1000,
					tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
					datasetrestrict:    constants.NULL.ADDRESS,
					workerpoolrestrict: constants.NULL.ADDRESS,
					requesterrestrict:  constants.NULL.ADDRESS,
					salt:               web3.utils.randomHex(32),
					sign:               constants.NULL.SIGNATURE,
				});
			});

			it("workerpool", async () => {
				workerpoolorder = await scheduler.signWorkerpoolOrder({
					workerpool:        WorkerpoolInstance.address,
					workerpoolprice:   100,
					volume:            1000,
					tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
					category:          4,
					trust:             0,
					apprestrict:       constants.NULL.ADDRESS,
					datasetrestrict:   constants.NULL.ADDRESS,
					requesterrestrict: constants.NULL.ADDRESS,
					salt:              web3.utils.randomHex(32),
					sign:              constants.NULL.SIGNATURE,
				});
			});

			it("requester", async () => {
				requestorder1 = await user.signRequestOrder({
					app:                AppInstance.address,
					appmaxprice:        0,
					dataset:            constants.NULL.ADDRESS,
					datasetmaxprice:    0,
					workerpool:         constants.NULL.ADDRESS,
					workerpoolmaxprice: 100,
					volume:             1,
					tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
					category:           4,
					trust:              0,
					requester:          user.address,
					beneficiary:        user.address,
					callback:           constants.NULL.ADDRESS,
					params:             "<parameters>",
					salt:               web3.utils.randomHex(32),
					sign:               constants.NULL.SIGNATURE,
				});
				requestorder2 = await user.signRequestOrder({
					app:                AppInstance.address,
					appmaxprice:        0,
					dataset:            constants.NULL.ADDRESS,
					datasetmaxprice:    0,
					workerpool:         constants.NULL.ADDRESS,
					workerpoolmaxprice: 100,
					volume:             1,
					tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
					category:           4,
					trust:              0,
					requester:          user.address,
					beneficiary:        user.address,
					callback:           constants.NULL.ADDRESS,
					params:             "<parameters>",
					salt:               web3.utils.randomHex(32),
					sign:               constants.NULL.SIGNATURE,
				});
			});
		});
	});

	describe("→ fill Kitty", async () => {
		it("[8.1a] match order", async () => {
			txMined = await IexecInstance.matchOrders(apporder, constants.NULL.DATAORDER, workerpoolorder, requestorder1, { from: user.address });
			deals[0] = tools.extractEvents(txMined, IexecInstance.address, "SchedulerNotice")[0].args.dealid;
		});

		it("[8.2a] initialize", async () => {
			txMined = await IexecInstance.initialize(deals[0], 0, { from: user.address });
			tasks[0] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[0].args.taskid;
		});

		it("wait", async () => {
			target = Number((await IexecInstance.viewTask(tasks[0])).finalDeadline);
			await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
		});

		it("[8.3a] claim", async () => {
			await IexecInstance.claim(tasks[0], { from: user.address });
		});

		it("kitty balance", async () => {
			kitty_address = await IexecInstance.kitty_address();
			kitty_content = await IexecInstance.frozenOf(kitty_address);
			assert.equal(kitty_content, 30);
		});

		it("balances", async () => {
			assert.deepEqual(await scheduler.viewAccount(), [  99970, 0 ], "check balance");
			assert.deepEqual(await worker1.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker2.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker3.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker4.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker5.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await user.viewAccount(),      [ 100000, 0 ], "check balance");
		})
	});

	describe("→ drain Kitty", async () => {
		it("[8.1b] match order", async () => {
			txMined = await IexecInstance.matchOrders(apporder, constants.NULL.DATAORDER, workerpoolorder, requestorder2, { from: user.address });
			deals[1] = tools.extractEvents(txMined, IexecInstance.address, "SchedulerNotice")[0].args.dealid;
		});

		it("[8.2b] initialize", async () => {
			txMined = await IexecInstance.initialize(deals[1], 0, { from: user.address });
			tasks[1] = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize")[0].args.taskid;
		});

		it("[8.3b] contribute", async () => {
			await sendContribution(
				tasks[1],
				worker1,
				odbtools.utils.sealResult(tasks[1], "true", worker1.address),
				await odbtools.utils.signAuthorization({ worker: worker1.address, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, scheduler.wallet),
				constants.NULL.ADDRESS
			);
		});

		it("[8.4b] reveal", async () => {
			await IexecInstance.reveal(tasks[1], odbtools.utils.hashResult(tasks[1], "true").digest, { from: worker1.address });
		});

		it("[8.5b] finalize", async () => {
			await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex("result"), "0x", { from: scheduler.address });
		});

		it("kitty balance", async () => {
			kitty_address = await IexecInstance.kitty_address();
			assert.equal(await IexecInstance.frozenOf(kitty_address), 0);
		});

		it("balances", async () => {
			assert.deepEqual(await scheduler.viewAccount(), [ 100005, 0 ], "check balance");
			assert.deepEqual(await worker1.viewAccount(),   [ 100095, 0 ], "check balance");
			assert.deepEqual(await worker2.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker3.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker4.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await worker5.viewAccount(),   [ 100000, 0 ], "check balance");
			assert.deepEqual(await user.viewAccount(),      [  99900, 0 ], "check balance");
		})
	});
});
