var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require("IexecInterface");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../../../utils/constants");
const odbtools  = require('../../../utils/odb-tools');
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('Poco', async (accounts) => {

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
				{ from: worker, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
	}

	describe("Setup", async () => {

		describe("tokens", async () => {
			it("distribute", async () => {
				assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");

				txMined = await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				txsMined = await Promise.all([
					IexecInstance.transfer(scheduler, 100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker1,   100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker2,   100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker3,   100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker4,   100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(worker5,   100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
					IexecInstance.transfer(user,      100000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
				]);
				assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
				assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("balances", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler      ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5        ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user           ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			})
		});

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

		describe("orders", async () => {
			it("app", async () => {
				apporder = odbtools.signAppOrder(
					{
						app:                AppInstance.address,
						appprice:           0,
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

			it("workerpool", async () => {
				workerpoolorder = odbtools.signWorkerpoolOrder(
					{
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
					},
					wallets.addressToPrivate(scheduler)
				);
			});

			it("requester", async () => {
				requestorder1 = odbtools.signRequestOrder(
					{
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
						requester:          user,
						beneficiary:        user,
						callback:           constants.NULL.ADDRESS,
						params:             "<parameters>",
						salt:               web3.utils.randomHex(32),
						sign:               constants.NULL.SIGNATURE,
					},
					wallets.addressToPrivate(user)
				);
				requestorder2 = odbtools.signRequestOrder(
					{
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
		});
	});

	describe("Fill Kitty", async () => {
		it("match order", async () => {
			txMined = await IexecInstance.matchOrders(apporder, constants.NULL.DATAORDER, workerpoolorder, requestorder1, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			deals[0] = extractEvents(txMined, IexecInstance.address, "SchedulerNotice")[0].args.dealid;
		});

		it("initialize", async () => {
			txMined = await IexecInstance.initialize(deals[0], 0, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			tasks[0] = extractEvents(txMined, IexecInstance.address, "TaskInitialize")[0].args.taskid;
		});

		it("wait", async () => {
			target = Number((await IexecInstance.viewTask(tasks[0])).finalDeadline);
			await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
		});

		it("claim", async () => {
			txMined = await IexecInstance.claim(tasks[0], { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		});

		it("kitty balance", async () => {
			kitty_address = await IexecInstance.KITTY_ADDRESS();
			kitty_content = await IexecInstance.frozenOf(kitty_address);
			assert.equal(kitty_content, 30);
		});

		it("balances", async () => {
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  99970, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
		})
	});

	describe("Drain Kitty", async () => {
		it("match order", async () => {
			txMined = await IexecInstance.matchOrders(apporder, constants.NULL.DATAORDER, workerpoolorder, requestorder2, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			deals[1] = extractEvents(txMined, IexecInstance.address, "SchedulerNotice")[0].args.dealid;
		});

		it("initialize", async () => {
			txMined = await IexecInstance.initialize(deals[1], 0, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			tasks[1] = extractEvents(txMined, IexecInstance.address, "TaskInitialize")[0].args.taskid;
		});

		it("contribute", async () => {
			await sendContribution(
				tasks[1],
				worker1,
				odbtools.sealResult(tasks[1], "true", worker1),
				await odbtools.signAuthorization({ worker: worker1, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, scheduler),
				constants.NULL.ADDRESS
			);
		});

		it("reveal", async () => {
			await IexecInstance.reveal(tasks[1], odbtools.hashResult(tasks[1], "true").digest, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("finalize", async () => {
			await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex("result"), { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("kitty balance", async () => {
			kitty_address = await IexecInstance.KITTY_ADDRESS();
			assert.equal(await IexecInstance.frozenOf(kitty_address), 0);
		});

		it("balances", async () => {
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100005, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker1  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100095, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker2  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker3  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker4  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(worker5  ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100000, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  99900, 0 ], "check balance");
		})
	});
});
