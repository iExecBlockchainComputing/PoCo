var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require("IexecInterface");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

var TestClient   = artifacts.require("./TestClient.sol");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../../utils/constants");
const odbtools  = require('../../utils/odb-tools');
const wallets   = require('../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('ERC1154: callback', async (accounts) => {

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
	var requestorder1   = null;
	var requestorder2   = null;
	var requestorder3   = null;

	var deals = {};
	var tasks = {};

	var TestClientInstance = null;

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance                = await RLC.deployed();
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

		TestClientInstance = await TestClient.new();
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
					events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
					AppInstance = await App.at(events[0].args.app);
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
					events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
					DatasetInstance = await Dataset.at(events[0].args.dataset);
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
					events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
					WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);
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
				assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");

				txMined = await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.owner,   iexecAdmin);
				assert.equal(extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.spender, IexecInstance.address);
				assert.equal(extractEvents(txMined, RLCInstance.address,   "Approval")[0].args.value,   10000000);
				assert.equal(extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.from,    iexecAdmin);
				assert.equal(extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.to,      IexecInstance.address);
				assert.equal(extractEvents(txMined, RLCInstance.address,   "Transfer")[0].args.value,   10000000);
				assert.equal(extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.from,    constants.NULL.ADDRESS);
				assert.equal(extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.to,      iexecAdmin);
				assert.equal(extractEvents(txMined, IexecInstance.address, "Transfer")[0].args.value,   10000000);

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

				assert.equal(extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[0], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[1], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[2], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[3], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[4], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[5], IexecInstance.address, "Transfer")[0].args.value, 1000);
				assert.equal(extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.from,  iexecAdmin);
				assert.equal(extractEvents(txsMined[6], IexecInstance.address, "Transfer")[0].args.value, 1000);
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
							apporder.sign,
							{}
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
							datasetorder.sign,
							{}
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
							workerpoolorder.sign,
							{}
						),
						"Error with the validation of the.workerpoolorder signature"
					);
				});
			});

			describe("request", async () => {
				describe("no callback", async () => {
					it("sign", async () => {
						requestorder1 = odbtools.signRequestOrder(
							{
								app:                AppInstance.address,
								appmaxprice:        3,
								dataset:            DatasetInstance.address,
								datasetmaxprice:    0,
								workerpool:         constants.NULL.ADDRESS,
								workerpoolmaxprice: 25,
								volume:             1,
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
								odbtools.RequestOrderTypedStructHash(requestorder1),
								requestorder1.sign,
								{}
							),
							"Error with the validation of the requestorder signature"
						);
					});
				});
				describe("invalid callback", async () => {
					it("sign", async () => {
						requestorder2 = odbtools.signRequestOrder(
							{
								app:                AppInstance.address,
								appmaxprice:        3,
								dataset:            DatasetInstance.address,
								datasetmaxprice:    0,
								workerpool:         constants.NULL.ADDRESS,
								workerpoolmaxprice: 25,
								volume:             1,
								tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
								category:           4,
								trust:              0,
								requester:          user,
								beneficiary:        user,
								callback:           AppInstance.address,
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
								odbtools.RequestOrderTypedStructHash(requestorder2),
								requestorder2.sign,
								{}
							),
							"Error with the validation of the requestorder signature"
						);
					});
				});
				describe("valid callback", async () => {
					it("sign", async () => {
						requestorder3 = odbtools.signRequestOrder(
							{
								app:                AppInstance.address,
								appmaxprice:        3,
								dataset:            DatasetInstance.address,
								datasetmaxprice:    0,
								workerpool:         constants.NULL.ADDRESS,
								workerpoolmaxprice: 25,
								volume:             1,
								tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
								category:           4,
								trust:              0,
								requester:          user,
								beneficiary:        user,
								callback:           TestClientInstance.address,
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
								odbtools.RequestOrderTypedStructHash(requestorder3),
								requestorder3.sign,
								{}
							),
							"Error with the validation of the requestorder signature"
						);
					});
				});
			});
		});

		describe("[1] order matching", async () => {
			it("[TX] match", async () => {
				txsMined = await Promise.all([
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder1, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder2, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder3, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
				]);
				assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				deals[1] = extractEvents(txsMined[0], IexecInstance.address, "OrdersMatched")[0].args.dealid;
				deals[2] = extractEvents(txsMined[1], IexecInstance.address, "OrdersMatched")[0].args.dealid;
				deals[3] = extractEvents(txsMined[2], IexecInstance.address, "OrdersMatched")[0].args.dealid;
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize", async () => {
				tasks[1] = extractEvents(await IexecInstance.initialize(deals[1], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
				tasks[2] = extractEvents(await IexecInstance.initialize(deals[2], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
				tasks[3] = extractEvents(await IexecInstance.initialize(deals[3], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
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
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[1], "true", worker1),
				);
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[2], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[2], "true", worker1),
				);
				await sendContribution(
					await odbtools.signAuthorization({ worker: worker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, scheduler),
					odbtools.sealResult(tasks[3], "true", worker1),
				);
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				await IexecInstance.reveal(tasks[1], odbtools.hashResult(tasks[1], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
				await IexecInstance.reveal(tasks[2], odbtools.hashResult(tasks[2], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
				await IexecInstance.reveal(tasks[3], odbtools.hashResult(tasks[3], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
			});
		});

		describe("[5] finalization", async () => {
			describe("no callback", async () => {
				it("[TX] no call", async () => {
					txMined = await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex("aResult 1"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[1],                          "check taskid");
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"), "check consensus (results)");
				});
			});

			describe("invalid callback", async () => {
				it("[TX] doesn't revert", async () => {
					txMined = await IexecInstance.finalize(tasks[2], web3.utils.utf8ToHex("aResult 2"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[2],                          "check taskid");
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"), "check consensus (results)");
				});
			});

			describe("valid callback", async () => {
				it("[TX] call", async () => {
					assert.equal(await TestClientInstance.store(tasks[3]), null, "Error in test client: store empty");

					txMined = await IexecInstance.finalize(tasks[3], web3.utils.utf8ToHex("aResult 3"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[3],                          "check taskid");
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 3"), "check consensus (results)");
				});

				it("check", async () => {
					assert.equal(await TestClientInstance.store(tasks[3]), web3.utils.utf8ToHex("aResult 3"), "Error in test client: dataset not stored");
				});
			});
		});
	});
});
