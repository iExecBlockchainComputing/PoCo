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
const multiaddr = require('multiaddr');
const tools     = require("../utils/tools");
const enstools  = require('../utils/ens-tools');
const odbtools  = require('../utils/odb-tools');
const constants = require("../utils/constants");
const wallets   = require('../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Fullchain', async (accounts) => {

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

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder        = null;
	var datasetorder    = null;
	var workerpoolorder = null;
	var requestorder    = null;

	var dealid = null;
	var tasks  = {
		0:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 0",
			workers :
			[
				{ address: worker1, useenclave: false, raw: "iExec BOT 0" },
				{ address: worker2, useenclave: false, raw: "iExec BOT 0" },
			]
		},
		1:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 1",
			workers :
			[
				{ address: worker2, useenclave: true, raw: "iExec BOT 1" },
				{ address: worker3, useenclave: true, raw: "iExec BOT 1" },
			]
		},
		2:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 2",
			workers :
			[
				{ address: worker1, useenclave: false, raw: "iExec BOT 2"       },
				{ address: worker3, useenclave: false, raw: "<timeout reached>" },
				{ address: worker2, useenclave: true,  raw: "iExec BOT 2"       },
				{ address: worker4, useenclave: true,  raw: "iExec BOT 2"       },
				{ address: worker5, useenclave: true,  raw: "iExec BOT 2"       },
			]
		},
	};
	var trusttarget = 4;

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

		await IexecInstance.setTeeBroker(teebroker.address);
		ERC712_domain = await IexecInstance.domain();
	});

	describe("→ setup", async () => {
		describe("assets", async () => {
			describe("app", async () => {
				it("create", async () => {
					txMined = await AppRegistryInstance.createApp(
						appProvider,
						"R Clifford Attractors",
						"DOCKER",
						constants.MULTIADDR_BYTES,
						constants.NULL.BYTES32,
						"0x",
						{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
					AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));
				});
			});

			describe("dataset", async () => {
				it("create", async () => {
					txMined = await DatasetRegistryInstance.createDataset(
						datasetProvider,
						"Pi",
						constants.MULTIADDR_BYTES,
						constants.NULL.BYTES32,
						{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
					DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));
				});
			});

			describe("workerpool", async () => {
				it("create", async () => {
					txMined = await WorkerpoolRegistryInstance.createWorkerpool(
						scheduler,
						"A test workerpool",
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
					WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));
				});

				it("change policy", async () => {
					txMined = await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				});
			});
		});

		describe("tokens", async () => {
			it("balances before", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});

			it("deposit", async () => {
				switch (DEPLOYMENT.asset)
				{
					case "Native":
						txMined = await IexecInstance.deposit({ from: iexecAdmin, value: 10000000 * 10 ** 9, gas: constants.AMOUNT_GAS_PROVIDED });
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.from,    constants.NULL.ADDRESS);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.to,      iexecAdmin);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.value,   10000000);
						break;

					case "Token":
						assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");

						txMined = await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.owner,   iexecAdmin);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.spender, IexecInstance.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.value,   10000000);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.from,    iexecAdmin);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.to,      IexecInstance.address);
						assert.equal(tools.extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.value,   10000000);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.from,    constants.NULL.ADDRESS);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.to,      iexecAdmin);
						assert.equal(tools.extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.value,   10000000);
						break;
				}

				txsMined = await Promise.all([
					IexecInstance.transfer(scheduler, 1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker1,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker2,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker3,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker4,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker5,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(user,      1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
				]);
				assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(tools.extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(tools.extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(tools.extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.value, 1000);
			});

			it("balances after", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000, 0 ], "check balance");
			});
		});

		it("score", async () => {
			assert.equal(Number(await IexecInstance.viewScore(worker1)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker2)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker3)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker4)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker5)), 0, "score issue");
		});
	});

	describe("→ pipeline", async () => {

		describe("[0] orders", async () => {
			describe("app", async () => {
				it("sign", async () => {
					apporder = odbtools.signAppOrder(
						ERC712_domain,
						{
							app:                AppInstance.address,
							appprice:           3,
							volume:             1000,
							tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
							datasetrestrict:    constants.NULL.ADDRESS,
							workerpoolrestrict: constants.NULL.ADDRESS,
							requesterrestrict:  constants.NULL.ADDRESS,
							salt:               web3.utils.randomHex(32),
							sign:               constants.NULL.SIGNATURE,
						},
						wallets.addressToPrivate(appProvider)
					);
				});
				it("verify", async () => {
					assert.isTrue(
						await IexecInstance.verifySignature(
							appProvider,
							odbtools.hashAppOrder(ERC712_domain, apporder),
							apporder.sign
						),
						"Error with the validation of the apporder signature"
					);
				});
			});

			describe("dataset", async () => {
				it("sign", async () => {
					datasetorder = odbtools.signDatasetOrder(
						ERC712_domain,
						{
							dataset:            DatasetInstance.address,
							datasetprice:       1,
							volume:             1000,
							tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
							apprestrict:        constants.NULL.ADDRESS,
							workerpoolrestrict: constants.NULL.ADDRESS,
							requesterrestrict:  constants.NULL.ADDRESS,
							salt:               web3.utils.randomHex(32),
							sign:               constants.NULL.SIGNATURE,
						},
						wallets.addressToPrivate(datasetProvider)
					);
				});
				it("verify", async () => {
					assert.isTrue(
						await IexecInstance.verifySignature(
							datasetProvider,
							odbtools.hashDatasetOrder(ERC712_domain, datasetorder),
							datasetorder.sign
						),
						"Error with the validation of the datasetorder signature"
					);
				});
			});

			describe("workerpool", async () => {
				it("sign", async () => {
					workerpoolorder1 = odbtools.signWorkerpoolOrder(
						ERC712_domain,
						{
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
						},
						wallets.addressToPrivate(scheduler)
					);
					workerpoolorder2 = odbtools.signWorkerpoolOrder(
						ERC712_domain,
						{
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
						},
						wallets.addressToPrivate(scheduler)
					);
				});
				it("verify", async () => {
					assert.isTrue(
						await IexecInstance.verifySignature(
							scheduler,
							odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder1),
							workerpoolorder1.sign
						),
						"Error with the validation of the workerpoolorder signature"
					);
					assert.isTrue(
						await IexecInstance.verifySignature(
							scheduler,
							odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder2),
							workerpoolorder2.sign
						),
						"Error with the validation of the workerpoolorder signature"
					);
				});
			});

			describe("request", async () => {
				it("sign", async () => {
					requestorder = odbtools.signRequestOrder(
						ERC712_domain,
						{
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
							requester:          user,
							beneficiary:        user,
							callback:           constants.NULL.ADDRESS,
							params:             "<parameters>",
							salt:               web3.utils.randomHex(32),
							sign:               constants.NULL.SIGNATURE,
						},
						wallets.addressToPrivate(user)
					);
				});
				it("verify", async () => {
					assert.isTrue(
						await IexecInstance.verifySignature(
							user,
							odbtools.hashRequestOrder(ERC712_domain, requestorder),
							requestorder.sign
						),
						"Error with the validation of the requestorder signature"
					);
				});
			});
		});

		describe("[1] order matching", async () => {
			it("[TX] match", async () => {
				txsMined = await Promise.all([
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder1, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder2, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
				]);
				assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				gasReceipt.push([ "matchOrders", txsMined[0].receipt.gasUsed ]);
				gasReceipt.push([ "matchOrders", txsMined[1].receipt.gasUsed ]);

				deal0 = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 0                                                      },
				);
				deal1 = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 2                                                      },
				);

				events = tools.extractEvents(txsMined[0], IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     deal0                     );

				events = tools.extractEvents(txsMined[1], IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     deal1                     );

				events = tools.extractEvents(txsMined[0], IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.appHash,        odbtools.hashAppOrder       (ERC712_domain, apporder        ));
				assert.equal(events[0].args.datasetHash,    odbtools.hashDatasetOrder   (ERC712_domain, datasetorder    ));
				assert.equal(events[0].args.workerpoolHash, odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder1));
				assert.equal(events[0].args.requestHash,    odbtools.hashRequestOrder   (ERC712_domain, requestorder    ));
				assert.equal(events[0].args.volume,         2                                                            );

				events = tools.extractEvents(txsMined[1], IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.appHash,        odbtools.hashAppOrder       (ERC712_domain, apporder        ));
				assert.equal(events[0].args.datasetHash,    odbtools.hashDatasetOrder   (ERC712_domain, datasetorder    ));
				assert.equal(events[0].args.workerpoolHash, odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder2));
				assert.equal(events[0].args.requestHash,    odbtools.hashRequestOrder   (ERC712_domain, requestorder    ));
				assert.equal(events[0].args.volume,         1                                                            );

				dealids = await odbtools.requestToDeal(IexecInstance, odbtools.hashRequestOrder(ERC712_domain, requestorder));
				assert.equal(dealids[0], deal0);
				assert.equal(dealids[1], deal1);
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize task", async () => {
				txMined = await IexecInstance.initialize(dealids[0], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);
				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				tasks[0].taskid = events[0].args.taskid;

				txMined = await IexecInstance.initialize(dealids[0], 1, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);
				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				tasks[1].taskid = events[0].args.taskid;

				txMined = await IexecInstance.initialize(dealids[1], 2, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
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
					if (w.useenclave) { w.enclaveWallet = web3.eth.accounts.create() }

					tasks[i].authorizations[w.address] = await odbtools.signAuthorization(
						{
							worker:  w.address,
							taskid:  tasks[i].taskid,
							enclave: w.useenclave ? w.enclaveWallet.address : constants.NULL.ADDRESS,
							sign:    constants.NULL.SIGNATURE,
						},
						w.useenclave ? teebroker : scheduler
					);
				}
			});

			it("run", async () => {
				for (i in tasks)
				{
					tasks[i].consensus = odbtools.hashResult(tasks[i].taskid, tasks[i].consensus);

					for (w of tasks[i].workers)
					{
						tasks[i].results[w.address] = odbtools.sealResult(tasks[i].taskid, w.raw, w.address);
						if (w.useenclave) // With SGX
						{
							await odbtools.signContribution(tasks[i].results[w.address], w.enclaveWallet);
						}
						else // Without SGX
						{
							tasks[i].results[w.address].sign = constants.NULL.SIGNATURE;
						}
					}
				}
			});

			it("[TX] contribute", async () => {
				for (i in tasks)
				for (w of tasks[i].workers)
				{
					txMined = await IexecInstance.contribute(
						tasks[i].authorizations[w.address].taskid,  // task (authorization)
						tasks[i].results[w.address].hash,           // common    (result)
						tasks[i].results[w.address].seal,           // unique    (result)
						tasks[i].authorizations[w.address].enclave, // address   (enclave)
						tasks[i].results[w.address].sign,           // signature (enclave)
						tasks[i].authorizations[w.address].sign,    // signature (authorization)
						{ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					gasReceipt.push([ "contribute", txMined.receipt.gasUsed ]);
				}
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				for (i in tasks)
				for (w of tasks[i].workers)
				if (tasks[i].results[w.address].hash == tasks[i].consensus.hash)
				{
					txMined = await IexecInstance.reveal(
						tasks[i].authorizations[w.address].taskid,
						tasks[i].results[w.address].digest,
						{ from: w.address }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskReveal");
					assert.equal(events[0].args.taskid, tasks[i].authorizations[w.address].taskid);
					assert.equal(events[0].args.worker, w.address                                );
					assert.equal(events[0].args.digest, tasks[i].results[w.address].digest       );
					gasReceipt.push([ "reveal", txMined.receipt.gasUsed ]);
				}
			});
		});

		describe("[5] finalization", async () => {

			describe("task 1", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[0].taskid,
						web3.utils.utf8ToHex("aResult 1"),
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[0].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"));
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[0].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                           );
						assert.equal    (       task.dealid,                   dealids[0]                                                                   );
						assert.equal    (Number(task.idx),                     0                                                                            );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
						assert.equal    (       task.consensusValue,           tasks[0].consensus.hash                                                      );
						assert.equal    (Number(task.revealCounter),           2                                                                            );
						assert.equal    (Number(task.winnerCounter),           2                                                                            );
						assert.deepEqual(       task.contributors.map(a => a), tasks[0].workers.map(x => x.address)                                         );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 1")                                            );
					});

					it("balances", async () => {
						balance = await IexecInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1 +  0 +  0, 0           ], "check balance");
						balance = await IexecInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3 +  0 +  0, 0           ], "check balance");
						balance = await IexecInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  1 -  4 -  7, 0 +  4 +  7 ], "check balance");
						balance = await IexecInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7      -  8, 0      +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7 -  5 -  8, 0 +  5 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      -  5 -  8, 0 +  5 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           -  8, 0      +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           -  8, 0      +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 19 - 19 - 29, 0 + 19 + 29 ], "check balance");
					});

					it("score", async () => {
						assert.equal(Number(await IexecInstance.viewScore(worker1)), 1, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker2)), 1, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker3)), 0, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker4)), 0, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker5)), 0, "score issue");
					});
				});
			});

			describe("task 2", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[1].taskid,
						web3.utils.utf8ToHex("aResult 2"),
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[1].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"));
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[1].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                           );
						assert.equal    (       task.dealid,                   dealids[0]                                                                   );
						assert.equal    (Number(task.idx),                     1                                                                            );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
						assert.equal    (       task.consensusValue,           tasks[1].consensus.hash                                                      );
						assert.equal    (Number(task.revealCounter),           2                                                                            );
						assert.equal    (Number(task.winnerCounter),           2                                                                            );
						assert.deepEqual(       task.contributors.map(a => a), tasks[1].workers.map(x => x.address)                                         );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 2")                                            );
					});

					it("balances", async () => {
						balance = await IexecInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1 +  1 +  0, 0      ], "check balance");
						balance = await IexecInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3 +  3 +  0, 0      ], "check balance");
						balance = await IexecInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  1 +  1 -  7, 0 +  7 ], "check balance");
						balance = await IexecInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7      -  8, 0 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7 +  7 -  8, 0 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      +  7 -  8, 0 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           -  8, 0 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           -  8, 0 +  8 ], "check balance");
						balance = await IexecInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 19 - 19 - 29, 0 + 29 ], "check balance");
					});

					it("score", async () => {
						assert.equal(Number(await IexecInstance.viewScore(worker1)), 1, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker2)), 2, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker3)), 1, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker4)), 0, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker5)), 0, "score issue");
					});
				});
			});

			describe("task 3", async () => {
				it("[TX] finalize", async () => {
					txMined = await IexecInstance.finalize(
						tasks[2].taskid,
						web3.utils.utf8ToHex("aResult 3"),
						{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[2].taskid                  );
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 3"));
					gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);
				});

				describe("checks", async () => {
					it("task", async () => {
						task = await IexecInstance.viewTask(tasks[2].taskid);
						assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                           );
						assert.equal    (       task.dealid,                   dealids[1]                                                                   );
						assert.equal    (Number(task.idx),                     2                                                                            );
						assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
						assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
						assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
						assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
						assert.equal    (       task.consensusValue,           tasks[2].consensus.hash                                                      );
						assert.equal    (Number(task.revealCounter),           4                                                                            );
						assert.equal    (Number(task.winnerCounter),           4                                                                            );
						assert.deepEqual(       task.contributors.map(a => a), tasks[2].workers.map(x => x.address)                                         );
						assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 3")                                            );
					});

					it("balances", async () => {
						balance = await IexecInstance.viewAccount(datasetProvider); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  1 +  1 +  1, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(appProvider    ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0 +  3 +  3 +  3, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(scheduler      ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  1 +  1 +  5, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(worker1        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7      +  7, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(worker2        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 +  7 +  7 +  7, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(worker3        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      +  7 -  8, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(worker4        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           +  7, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(worker5        ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000           +  7, 0 ], "check balance");
						balance = await IexecInstance.viewAccount(user           ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 19 - 19 - 29, 0 ], "check balance");
					});

					it("score", async () => {
						assert.equal(Number(await IexecInstance.viewScore(worker1)), 2, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker2)), 3, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker3)), 0, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker4)), 1, "score issue");
						assert.equal(Number(await IexecInstance.viewScore(worker5)), 1, "score issue");
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
