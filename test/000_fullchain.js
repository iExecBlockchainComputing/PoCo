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
	var results        = {};
	var consensus      = null;
	var workers        = [];

	var gasReceipt = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		trusttarget = 4;
		workers = [
			{ address: worker1, enclave: sgxEnclave,             raw: "iExec the wanderer" },
			{ address: worker2, enclave: constants.NULL.ADDRESS, raw: "iExec the wanderer" },
		];
		consensus = "iExec the wanderer";

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		ERC712_domain              = await IexecInstance.domain();
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   appProvider);
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   datasetProvider);
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
					assert.equal(events[0].args.from, constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,   scheduler);
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
					workerpoolorder = odbtools.signWorkerpoolOrder(
						ERC712_domain,
						{
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
						},
						wallets.addressToPrivate(scheduler)
					);
				});
				it("verify", async () => {
					assert.isTrue(
						await IexecInstance.verifySignature(
							scheduler,
							odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder),
							workerpoolorder.sign
						),
						"Error with the validation of the.workerpoolorder signature"
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
							volume:             1, // CHANGE FOR BOT
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
				txMined = await IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				gasReceipt.push([ "matchOrders", txMined.receipt.gasUsed ]);

				dealid = web3.utils.soliditySha3(
					{ t: 'bytes32', v: odbtools.hashRequestOrder(ERC712_domain, requestorder) },
					{ t: 'uint256', v: 0                                                      },
				);

				events = tools.extractEvents(txMined, IexecInstance.address, "SchedulerNotice");
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
				assert.equal(events[0].args.dealid,     dealid                    );

				events = tools.extractEvents(txMined, IexecInstance.address, "OrdersMatched");
				assert.equal(events[0].args.dealid,         dealid                                                      );
				assert.equal(events[0].args.appHash,        odbtools.hashAppOrder       (ERC712_domain, apporder       ));
				assert.equal(events[0].args.datasetHash,    odbtools.hashDatasetOrder   (ERC712_domain, datasetorder   ));
				assert.equal(events[0].args.workerpoolHash, odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder));
				assert.equal(events[0].args.requestHash,    odbtools.hashRequestOrder   (ERC712_domain, requestorder   ));
				assert.equal(events[0].args.volume,         1                                                           );
			});

			describe("checks", async () => {
				it("deal", async () => {
					deal = await IexecInstance.viewDeal(dealid);
					assert.equal    (       deal.app.pointer,           AppInstance.address,             "check deal (deal.app.pointer)"         );
					assert.equal    (       deal.app.owner,             appProvider,                     "check deal (deal.app.owner)"           );
					assert.equal    (Number(deal.app.price           ), apporder.appprice,               "check deal (deal.app.price)"           );
					assert.equal    (       deal.app.pointer,           requestorder.app,                "check deal (deal.app.pointer)"         );
					assert.isAtMost (Number(deal.app.price           ), requestorder.appmaxprice,        "check deal (deal.app.price)"           );
					assert.equal    (       deal.dataset.pointer,       DatasetInstance.address,         "check deal (deal.dataset.pointer)"     );
					assert.equal    (       deal.dataset.owner,         datasetProvider,                 "check deal (deal.dataset.owner)"       );
					assert.equal    (Number(deal.dataset.price       ), datasetorder.datasetprice,       "check deal (deal.dataset.price)"       );
					assert.equal    (       deal.dataset.pointer,       requestorder.dataset,            "check deal (deal.dataset.pointer)"     );
					assert.isAtMost (Number(deal.dataset.price       ), requestorder.datasetmaxprice,    "check deal (deal.dataset.price)"       );
					assert.equal    (       deal.workerpool.pointer,    WorkerpoolInstance.address,      "check deal (deal.workerpool.pointer)"  );
					assert.equal    (       deal.workerpool.owner,      scheduler,                       "check deal (deal.workerpool.owner)"    );
					assert.equal    (Number(deal.workerpool.price    ), workerpoolorder.workerpoolprice, "check deal (deal.workerpool.price)"    );
					if( requestorder.workerpool != constants.NULL.ADDRESS)
					assert.equal    (       deal.workerpool.pointer,    requestorder.workerpool,         "check deal (deal.workerpool.pointer)"  );
					assert.isAtMost (Number(deal.workerpool.price    ), requestorder.workerpoolmaxprice, "check deal (deal.workerpool.price)"    );
					assert.equal    (Number(deal.trust               ), workerpoolorder.trust,           "check deal (deal.trust)"               );
					assert.isAtLeast(Number(deal.trust               ), requestorder.trust,              "check deal (deal.trust)"               );
					assert.equal    (Number(deal.category            ), workerpoolorder.category,        "check deal (deal.category)"            );
					assert.equal    (Number(deal.category            ), requestorder.category,           "check deal (deal.category)"            );
					assert.equal    (Number(deal.tag                 ), workerpoolorder.tag,             "check deal (deal.tag)"                 );
					assert.equal    (Number(deal.tag                 ), requestorder.tag,                "check deal (deal.tag)"                 );
					assert.equal    (       deal.requester,             user,                            "check deal (deal.requester)"           );
					assert.equal    (       deal.beneficiary,           user,                            "check deal (deal.beneficiary)"         );
					assert.equal    (       deal.callback,              requestorder.callback,           "check deal (deal.callback)"            );
					assert.equal    (       deal.params,                requestorder.params,             "check deal (deal.params)"              );
					assert.isAbove  (Number(deal.startTime           ), 0,                               "check deal (deal.start)"               );
					assert.equal    (Number(deal.botFirst            ), 0,                               "check deal (deal.botFirst)"            );
					assert.equal    (Number(deal.botSize             ), 1,                               "check deal (deal.botSize)"             );
					assert.equal    (Number(deal.workerStake         ), 8,                               "check deal (deal.workerStake)"         ); // 8 = floor(25*.3)
					assert.equal    (Number(deal.schedulerRewardRatio), 5,                               "check deal (deal.schedulerRewardRatio)");
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  993,  7 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971, 29 ], "check balance");
				});
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize", async () => {
				txMined = await IexecInstance.initialize(dealid, 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				gasReceipt.push([ "initialize", txMined.receipt.gasUsed ]);

				taskid = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskInitialize");
				assert.equal(events[0].args.taskid,     taskid                    );
				assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTask(taskid);
					assert.equal    (       task.status,                constants.TaskStatusEnum.ACTIVE                                              );
					assert.equal    (       task.dealid,                dealid                                                                       );
					assert.equal    (Number(task.idx),                  0                                                                            );
					assert.equal    (Number(task.timeref),              (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
					assert.isAbove  (Number(task.contributionDeadline), 0                                                                            );
					assert.equal    (Number(task.revealDeadline),       0                                                                            );
					assert.isAbove  (Number(task.finalDeadline),        0                                                                            );
					assert.equal    (       task.consensusValue,        constants.NULL.BYTES32                                                       );
					assert.equal    (Number(task.revealCounter),        0                                                                            );
					assert.equal    (Number(task.winnerCounter),        0                                                                            );
					assert.deepEqual(       task.contributors,          []                                                                           );
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  993,  7 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971, 29 ], "check balance");
				});
			});
		});

		describe("[3] contribute", async () => {
			it("authorization signature", async () => {
				for (w of workers)
				{
					authorizations[w.address] = await odbtools.signAuthorization(
						{
							worker:  w.address,
							taskid:  taskid,
							enclave: w.enclave,
							sign:    constants.NULL.SIGNATURE,
						},
						scheduler
					);
				}
			});

			it("run", async () => {
				consensus = odbtools.hashResult(taskid, consensus);
				for (w of workers)
				{
					results[w.address] = odbtools.sealResult(taskid, w.raw, w.address);
					if (w.enclave != constants.NULL.ADDRESS) // With SGX
					{
						await odbtools.signContribution(results[w.address], w.enclave);
					}
					else // Without SGX
					{
						results[w.address].sign = constants.NULL.SIGNATURE;
					}
				}
			});

			describe("worker 1", async () => {
				it("[TX] contribute", async () => {
					w = workers[0]
					// for (w of workers)
					{
						txMined = await IexecInstance.contribute(
							authorizations[w.address].taskid,  // task (authorization)
							results[w.address].hash,           // common    (result)
							results[w.address].seal,           // unique    (result)
							authorizations[w.address].enclave, // address   (enclave)
							results[w.address].sign,           // signature (enclave)
							authorizations[w.address].sign,    // signature (authorization)
							{ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
						);
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

						events = tools.extractEvents(txMined, IexecInstance.address, "TaskContribute");
						assert.equal(events[0].args.taskid, authorizations[w.address].taskid);
						assert.equal(events[0].args.worker, w.address                       );
						assert.equal(events[0].args.hash,   results[w.address].hash         );
						gasReceipt.push([ "contribute", txMined.receipt.gasUsed ]);
					}
				});
				describe("checks", async () => {
					it("contribution", async () => {
						w = workers[0]
						// for (w of workers)
						{
							contribution = await IexecInstance.viewContribution(taskid, w.address);
							assert.equal(contribution.status,           constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
							assert.equal(contribution.resultHash,       results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
							assert.equal(contribution.resultSeal,       results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
							assert.equal(contribution.enclaveChallenge, w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
						}
					});
				});

				it("task", async () => {
					task = await IexecInstance.viewTask(taskid);
					assert.equal    (       task.status,                   constants.TaskStatusEnum.ACTIVE                                              );
					assert.equal    (       task.dealid,                   dealid                                                                       );
					assert.equal    (Number(task.idx),                     0                                                                            );
					assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
					assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
					assert.equal    (Number(task.revealDeadline),          0                                                                            );
					assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
					assert.equal    (       task.consensusValue,           constants.NULL.BYTES32                                                       );
					assert.equal    (Number(task.revealCounter),           0                                                                            );
					assert.equal    (Number(task.winnerCounter),           0                                                                            );
					assert.deepEqual(       task.contributors.map(a => a), [ workers[0].address ]                                                       );
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  993,  7 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  992,  8 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971, 29 ], "check balance");
				});
			});

			describe("worker 2 - TEE", async () => {
				it("[TX] contribute", async () => {
					w = workers[1]
					// for (w of workers)
					{
						txMined = await IexecInstance.contribute(
							authorizations[w.address].taskid, // task (authorization)
							results[w.address].hash,          // common    (result)
							results[w.address].seal,          // unique    (result)
							w.enclave,                        // address   (enclave)
							results[w.address].sign,          // signature (enclave)
							authorizations[w.address].sign,   // signature (authorization)
							{ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
						);
						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

						events = tools.extractEvents(txMined, IexecInstance.address, "TaskContribute");
						assert.equal(events[0].args.taskid, authorizations[w.address].taskid);
						assert.equal(events[0].args.worker, w.address                       );
						assert.equal(events[0].args.hash,   results[w.address].hash         );

						events = tools.extractEvents(txMined, IexecInstance.address, "TaskConsensus");
						assert.equal(events[0].args.taskid,    taskid        );
						assert.equal(events[0].args.consensus, consensus.hash);
						gasReceipt.push([ "contribute (TEE)", txMined.receipt.gasUsed ]);
					}
				});
				describe("checks", async () => {
					it("contribution", async () => {
						w = workers[1]
						// for (w of workers)
						{
							contribution = await IexecInstance.viewContribution(taskid, w.address);
							assert.equal(contribution.status,           constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
							assert.equal(contribution.resultHash,       results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
							assert.equal(contribution.resultSeal,       results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
							assert.equal(contribution.enclaveChallenge, w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
						}
					});
				});

				it("task", async () => {
					task = await IexecInstance.viewTask(taskid);
					assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING                                           );
					assert.equal    (       task.dealid,                   dealid                                                                       );
					assert.equal    (Number(task.idx),                     0                                                                            );
					assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
					assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
					assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
					assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
					assert.equal    (       task.consensusValue,           consensus.hash                                                               );
					assert.equal    (Number(task.revealCounter),           0                                                                            );
					assert.equal    (Number(task.winnerCounter),           workers.length                                                               );
					assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address)                                                           );
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  993,  7 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  992,  8 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  992,  8 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971, 29 ], "check balance");
				});
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				for (w of workers)
				if (results[w.address].hash == consensus.hash)
				{
					txMined = await IexecInstance.reveal(
						taskid,
						results[w.address].digest,
						{ from: w.address }
					);
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					events = tools.extractEvents(txMined, IexecInstance.address, "TaskReveal");
					assert.equal(events[0].args.taskid, taskid                   );
					assert.equal(events[0].args.worker, w.address                );
					assert.equal(events[0].args.digest, results[w.address].digest);
					gasReceipt.push([ "reveal", txMined.receipt.gasUsed ]);
				}
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTask(taskid);
					assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING                                           );
					assert.equal    (       task.dealid,                   dealid                                                                       );
					assert.equal    (Number(task.idx),                     0                                                                            );
					assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
					assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
					assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
					assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
					assert.equal    (       task.consensusValue,           consensus.hash                                                               );
					assert.equal    (Number(task.revealCounter),           workers.length                                                               );
					assert.equal    (Number(task.winnerCounter),           workers.length                                                               );
					assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address)                                                  );
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    0,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  993,  7 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  992,  8 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  992,  8 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971, 29 ], "check balance");
				});
			});
		});

		describe("[5] finalization", async () => {
			it("[TX] finalize", async () => {
				txMined = await IexecInstance.finalize(taskid, web3.utils.utf8ToHex("aResult"), { from: scheduler, gasLimit: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
				assert.equal(events[0].args.taskid,  taskid                         );
				assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"));
				gasReceipt.push([ "finalize", txMined.receipt.gasUsed ]);

				// TODO: check 2 events by w.address for w in workers
				// How to retreive events from the IexecClerk (5 rewards and 1 seize)
			});

			describe("checks", async () => {
				it("task", async () => {
					task = await IexecInstance.viewTask(taskid);
					assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED                                           );
					assert.equal    (       task.dealid,                   dealid                                                                       );
					assert.equal    (Number(task.idx),                     0                                                                            );
					assert.equal    (Number(task.timeref),                 (await IexecInstance.viewCategory(requestorder.category)).workClockTimeRef);
					assert.isAbove  (Number(task.contributionDeadline),    0                                                                            );
					assert.isAbove  (Number(task.revealDeadline),          0                                                                            );
					assert.isAbove  (Number(task.finalDeadline),           0                                                                            );
					assert.equal    (       task.consensusValue,           consensus.hash                                                               );
					assert.equal    (Number(task.revealCounter),           workers.length                                                               );
					assert.equal    (Number(task.winnerCounter),           workers.length                                                               );
					assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address)                                                  );
					assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult")                                              );
				});

				it("balances", async () => {
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    1,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    3,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1003,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1011,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1011,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971,  0 ], "check balance");
				});
			});
		});
	});

	describe("→ summary", async () => {
		it("balances", async () => {
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(datasetProvider), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    1,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(appProvider    ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [    3,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1003,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1011,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1011,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 1000,  0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  971,  0 ], "check balance");
		});

		it("balances - extra", async () => {
			assert.equal(
				Number(await IexecInstance.totalSupply()),
				DEPLOYMENT.asset == "Native"
					? Number(await web3.eth.getBalance(IexecInstance.address)) / 10 ** 9
					: Number(await RLCInstance.balanceOf(IexecInstance.address))
			);

			for (address of [ datasetProvider, appProvider, scheduler, worker1, worker2, worker3, worker4, worker5, user ])
			{
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(address), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ Number(await IexecInstance.balanceOf(address)), Number(await IexecInstance.frozenOf(address)) ], "check balance");
			}
		});

		it("score", async () => {
			assert.equal(Number(await IexecInstance.viewScore(worker1)), 1, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker2)), 1, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker3)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker4)), 0, "score issue");
			assert.equal(Number(await IexecInstance.viewScore(worker5)), 0, "score issue");
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
