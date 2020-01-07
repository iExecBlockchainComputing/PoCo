// Config
var DEPLOYMENT = require("../../config/deployment.json")
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
const tools     = require("../../utils/tools");
const enstools  = require('../../utils/ens-tools');
const odbtools  = require('../../utils/odb-tools');
const constants = require("../../utils/constants");
const wallets   = require('../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('ERC1154: resultFor', async (accounts) => {

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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecInstance.address,
		});
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
							odbtools.AppOrderTypedStructHash(apporder),
							apporder.sign
						),
						"Error with the validation of the apporder signature"
					);
				});
			});

			describe("dataset", async () => {
				it("sign", async () => {
					datasetorder = odbtools.signDatasetOrder(
						{
							dataset:            DatasetInstance.address,
							datasetprice:       0,
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
							odbtools.DatasetOrderTypedStructHash(datasetorder),
							datasetorder.sign
						),
						"Error with the validation of the datasetorder signature"
					);
				});
			});

			describe("workerpool", async () => {
				it("sign", async () => {
					workerpoolorder = odbtools.signWorkerpoolOrder(
						{
							workerpool:        WorkerpoolInstance.address,
							workerpoolprice:   25,
							volume:            1000,
							category:          4,
							trust:             0,
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
							odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder),
							workerpoolorder.sign
						),
						"Error with the validation of the.workerpoolorder signature"
					);
				});
			});

			describe("request", async () => {
				it("sign", async () => {
					requestorder = odbtools.signRequestOrder(
						{
							app:                AppInstance.address,
							appmaxprice:        3,
							dataset:            DatasetInstance.address,
							datasetmaxprice:    0,
							workerpool:         constants.NULL.ADDRESS,
							workerpoolmaxprice: 25,
							volume:             10,
							tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
							category:           4,
							trust:              0,
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
							odbtools.RequestOrderTypedStructHash(requestorder),
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
				deals = await odbtools.requestToDeal(IexecInstance, odbtools.RequestOrderTypedStructHash(requestorder));
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize", async () => {
				tasks[0] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[0] }, { t: 'uint256', v: 0 });                                                                                              // uninitialized
				tasks[1] = tools.extractEvents(await IexecInstance.initialize(deals[0], 1, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // finalized
				tasks[2] = tools.extractEvents(await IexecInstance.initialize(deals[0], 2, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // initialized
				tasks[3] = tools.extractEvents(await IexecInstance.initialize(deals[0], 3, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // contributions
				tasks[4] = tools.extractEvents(await IexecInstance.initialize(deals[0], 4, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // consensus
				tasks[5] = tools.extractEvents(await IexecInstance.initialize(deals[0], 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // reveal
			});
		});

		function sendContribution(authorization, results)
		{
			return IexecInstance.contribute(
					authorization.taskid,                                   // task (authorization)
					results.hash,                                           // common    (result)
					results.seal,                                           // unique    (result)
					authorization.enclave,                                  // address   (enclave)
					results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
					authorization.sign,                                     // signature (authorization)
					{ from: authorization.worker, gasLimit: constants.AMOUNT_GAS_PROVIDED }
				);
		}

		describe("[3] contribute", async () => {
			it("[TX] contribute", async () => {
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[2], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[2], "true", worker1),
				);
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[3], "true", worker1),
				);
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[4], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[4], "true", worker1),
				);
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[5], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[5], "true", worker1),
				);
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				await IexecInstance.reveal(tasks[4], odbtools.hashResult(tasks[4], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
				await IexecInstance.reveal(tasks[5], odbtools.hashResult(tasks[5], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
			});
		});

		describe("[5] finalization", async () => {
			it("[TX] finalize", async () => {
				await IexecInstance.finalize(tasks[5], web3.utils.utf8ToHex("aResult 5"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
			});
		});
	});

	describe("→ result for", async () => {
		describe("uninitialized", async () => {
			it("reverts", async () => {
				await expectRevert.unspecified(IexecInstance.resultFor(tasks[0]));
			});
		});
		describe("initialized", async () => {
			it("reverts", async () => {
				await expectRevert.unspecified(IexecInstance.resultFor(tasks[1]));
			});
		});
		describe("contributed", async () => {
			it("reverts", async () => {
				await expectRevert.unspecified(IexecInstance.resultFor(tasks[2]));
			});
		});
		describe("consensus", async () => {
			it("reverts", async () => {
				await expectRevert.unspecified(IexecInstance.resultFor(tasks[3]));
			});
		});
		describe("reveal", async () => {
			it("reverts", async () => {
				await expectRevert.unspecified(IexecInstance.resultFor(tasks[4]));
			});
		});
		describe("finalized", async () => {
			it("valid", async () => {
				assert.equal(await IexecInstance.resultFor(tasks[5]), web3.utils.utf8ToHex("aResult 5"), "resultFor returned incorrect value");
			});
		});
	});
});
