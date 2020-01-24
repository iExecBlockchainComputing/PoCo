// Config
var DEPLOYMENT         = require("../../config/config.json").chains.default;
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

var TestClient   = artifacts.require("./TestClient.sol");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const multiaddr = require('multiaddr');
const tools     = require("../../utils/tools");
const enstools  = require('../../utils/ens-tools');
const odbtools  = require('../../utils/odb-tools');
const constants = require("../../utils/constants");
const wallets   = require('../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('ERC1154: callback', async (accounts) => {

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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();

		agentBroker    = new odbtools.MockBroker(IexecInstance);
		agentScheduler = new odbtools.MockScheduler(scheduler);
		await agentBroker.initialize();

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
							odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder),
							workerpoolorder.sign
						),
						"Error with the validation of the.workerpoolorder signature"
					);
				});
			});

			describe("request", async () => {
				describe("no callback", async () => {
					it("sign", async () => {
						requestorder1 = odbtools.signRequestOrder(
							ERC712_domain,
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
								odbtools.hashRequestOrder(ERC712_domain, requestorder1),
								requestorder1.sign
							),
							"Error with the validation of the requestorder signature"
						);
					});
				});
				describe("invalid callback", async () => {
					it("sign", async () => {
						requestorder2 = odbtools.signRequestOrder(
							ERC712_domain,
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
								odbtools.hashRequestOrder(ERC712_domain, requestorder2),
								requestorder2.sign
							),
							"Error with the validation of the requestorder signature"
						);
					});
				});
				describe("valid callback", async () => {
					it("sign", async () => {
						requestorder3 = odbtools.signRequestOrder(
							ERC712_domain,
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
								odbtools.hashRequestOrder(ERC712_domain, requestorder3),
								requestorder3.sign
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

				deals[1] = tools.extractEvents(txsMined[0], IexecInstance.address, "OrdersMatched")[0].args.dealid;
				deals[2] = tools.extractEvents(txsMined[1], IexecInstance.address, "OrdersMatched")[0].args.dealid;
				deals[3] = tools.extractEvents(txsMined[2], IexecInstance.address, "OrdersMatched")[0].args.dealid;
			});
		});

		describe("[2] initialization", async () => {
			it("[TX] initialize", async () => {
				tasks[1] = tools.extractEvents(await IexecInstance.initialize(deals[1], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
				tasks[2] = tools.extractEvents(await IexecInstance.initialize(deals[2], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
				tasks[3] = tools.extractEvents(await IexecInstance.initialize(deals[3], 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }), IexecInstance.address, "TaskInitialize")[0].args.taskid;
			});
		});

		async function sendContribution(worker, taskid, result, useenclave = true)
		{
			const agent            = new odbtools.MockWorker(worker);
			const preauth          = await agentScheduler.signPreAuthorization(taskid, worker);
			const [ auth, secret ] = useenclave ? await agentBroker.signAuthorization(preauth) : [ preauth, null ];
			const results          = await agent.run(auth, secret, result);

			return IexecInstance.contribute(
				auth.taskid,  // task (authorization)
				results.hash, // common    (result)
				results.seal, // unique    (result)
				auth.enclave, // address   (enclave)
				results.sign, // signature (enclave)
				auth.sign,    // signature (authorization)
				{ from: worker, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
		}

		describe("[3] contribute", async () => {
			it("[TX] contribute", async () => {
				await sendContribution(worker1, tasks[1], "true", false);
				await sendContribution(worker1, tasks[2], "true", false);
				await sendContribution(worker1, tasks[3], "true", false);
			});
		});

		describe("[4] reveal", async () => {
			it("[TX] reveal", async () => {
				await IexecInstance.reveal(tasks[1], odbtools.utils.hashResult(tasks[1], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
				await IexecInstance.reveal(tasks[2], odbtools.utils.hashResult(tasks[2], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
				await IexecInstance.reveal(tasks[3], odbtools.utils.hashResult(tasks[3], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
			});
		});

		describe("[5] finalization", async () => {
			describe("no callback", async () => {
				it("[TX] no call", async () => {
					txMined = await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex("aResult 1"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[1],                          "check taskid");
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"), "check consensus (results)");
				});
			});

			describe("invalid callback", async () => {
				it("[TX] doesn't revert", async () => {
					txMined = await IexecInstance.finalize(tasks[2], web3.utils.utf8ToHex("aResult 2"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
					assert.equal(events[0].args.taskid,  tasks[2],                          "check taskid");
					assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"), "check consensus (results)");
				});
			});

			describe("valid callback", async () => {
				it("[TX] call", async () => {
					assert.equal(await TestClientInstance.store(tasks[3]), null, "Error in test client: store empty");

					txMined = await IexecInstance.finalize(tasks[3], web3.utils.utf8ToHex("aResult 3"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
					events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
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
