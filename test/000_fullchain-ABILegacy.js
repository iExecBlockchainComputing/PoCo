var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");
var Broker             = artifacts.require("./Broker.sol");

var IexecHubABILegacy   = artifacts.require("./IexecHubABILegacy.sol");
var IexecClerkABILegacy = artifacts.require("./IexecClerkABILegacy.sol");

const constants = require("./constants");
const odbtools  = require('../utils/odb-tools');

const wallets   = require('./wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let user            = accounts[8];
	let sgxEnclave      = accounts[9];

	var RLCInstance                = null;
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;
	var BrokerInstance             = null;

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
		RLCInstance                = await RLC.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecClerkInstance         = await IexecClerk.deployed();
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		BrokerInstance             = await Broker.deployed();

		/**
		 * For ABILegacy
		 */
		IexecClerkInstanceFull = IexecClerkInstance;
		IexecHubInstance       = await IexecHubABILegacy.at(IexecHubInstance.address);
		IexecClerkInstance     = await IexecClerkABILegacy.at(IexecClerkInstance.address);

		/**
		 * Domain setup
		 */
		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * Token distribution
		 */
		assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");
		txsMined = await Promise.all([
			RLCInstance.transfer(appProvider,     1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(datasetProvider, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(scheduler,       1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker1,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker2,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker3,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(worker4,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,            1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(appProvider),
			RLCInstance.balanceOf(datasetProvider),
			RLCInstance.balanceOf(scheduler),
			RLCInstance.balanceOf(worker1),
			RLCInstance.balanceOf(worker2),
			RLCInstance.balanceOf(worker3),
			RLCInstance.balanceOf(worker4),
			RLCInstance.balanceOf(user)
		]);
		assert.equal(balances[0], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[1], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[2], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[3], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[4], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[5], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[6], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[7], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker1,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker2,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker3,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker4,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,            gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
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

	/***************************************************************************
	 *               TEST: Dataset creation (by datasetProvider)               *
	 ***************************************************************************/
	it("[Genesis] Dataset Creation", async () => {
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

	/***************************************************************************
	 *                TEST: Workerpool creation (by scheduler)                 *
	 ***************************************************************************/
	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);
	});

	/***************************************************************************
	 *              TEST: Workerpool configuration (by scheduler)              *
	 ***************************************************************************/
	it("[Genesis] Workerpool Configuration", async () => {
		txMined = await WorkerpoolInstance.changePolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *               TEST: App order signature (by appProvider)                *
	 ***************************************************************************/
	it("[Genesis] Generate app order", async () => {
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
		assert.isTrue(
			await IexecClerkInstanceFull.verifySignature(
				appProvider,
				odbtools.AppOrderTypedStructHash(apporder),
				apporder.sign,
				{}
			),
			"Error with the validation of the apporder signature"
		);
	});

	/***************************************************************************
	 *           TEST: Dataset order signature (by datasetProvider)            *
	 ***************************************************************************/
	it("[Genesis] Generate dataset order", async () => {
		datasetorder = odbtools.signDatasetOrder(
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
		assert.isTrue(
			await IexecClerkInstanceFull.verifySignature(
				datasetProvider,
				odbtools.DatasetOrderTypedStructHash(datasetorder),
				datasetorder.sign,
				{}
			),
			"Error with the validation of the datasetorder signature"
		);
	});

	/***************************************************************************
	 *             TEST: Workerpool order signature (by scheduler)             *
	 ***************************************************************************/
	it("[Genesis] Generate.workerpool order", async () => {
		workerpoolorder = odbtools.signWorkerpoolOrder(
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
		assert.isTrue(
			await IexecClerkInstanceFull.verifySignature(
				scheduler,
				odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder),
				workerpoolorder.sign,
				{}
			),
			"Error with the validation of the.workerpoolorder signature"
		);
	});

	/***************************************************************************
	 *                 TEST: Requestorder signature (by user)                  *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		requestorder = odbtools.signRequestOrder(
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
		assert.isTrue(
			await IexecClerkInstanceFull.verifySignature(
				user,
				odbtools.RequestOrderTypedStructHash(requestorder),
				requestorder.sign,
				{}
			),
			"Error with the validation of the requestorder signature"
		);
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Genesis] Check balances", async () => {
		// IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
		// IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstanceFull.deposit(1000, { from: scheduler }),
			IexecClerkInstanceFull.deposit(1000, { from: worker1   }),
			IexecClerkInstanceFull.deposit(1000, { from: worker2   }),
			IexecClerkInstanceFull.deposit(1000, { from: worker3   }),
			IexecClerkInstanceFull.deposit(1000, { from: worker4   }),
			IexecClerkInstanceFull.deposit(1000, { from: user      }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[Initial] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstanceFull.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		dealid = web3.utils.soliditySha3(
			{ t: 'bytes32', v: odbtools.RequestOrderTypedStructHash(requestorder) },
			{ t: 'uint256', v: 0                                                  },
		);

		events = extractEvents(txMined, IexecClerkInstance.address, "SchedulerNotice");
		assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
		assert.equal(events[0].args.dealid,     dealid                    );

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.dealid,         dealid                                                  );
		assert.equal(events[0].args.appHash,        odbtools.AppOrderTypedStructHash       (apporder       ));
		assert.equal(events[0].args.datasetHash,    odbtools.DatasetOrderTypedStructHash   (datasetorder   ));
		assert.equal(events[0].args.workerpoolHash, odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder));
		assert.equal(events[0].args.requestHash,    odbtools.RequestOrderTypedStructHash   (requestorder   ));
		assert.equal(events[0].args.volume,         1                                                       );
	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("[Market] Check deal", async () => {
		deal_pt1 = await IexecClerkInstance.viewDealABILegacy_pt1(dealid);
		assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , AppInstance.address,             "check deal (deal.dapp.pointer)");
		assert.equal    (deal_pt1[0]            /*dapp.pointer*/ , requestorder.app,                "check deal (deal.dapp.pointer)");
		assert.equal    (deal_pt1[1]            /*dapp.owner*/   , appProvider,                     "check deal (deal.dapp.owner)"  );
		assert.equal    (deal_pt1[2].toNumber() /*dapp.price*/   , apporder.appprice,               "check deal (deal.dapp.price)"  );
		assert.isAtMost (deal_pt1[2].toNumber() /*dapp.price*/   , requestorder.appmaxprice,        "check deal (deal.dapp.price)"  );

		assert.equal    (deal_pt1[3]            /*data.pointer*/ , DatasetInstance.address,         "check deal (deal.data.pointer)");
		assert.equal    (deal_pt1[3]            /*data.pointer*/ , requestorder.dataset,            "check deal (deal.data.pointer)");
		assert.equal    (deal_pt1[4]            /*data.owner*/   , datasetProvider,                 "check deal (deal.data.owner)"  );
		assert.equal    (deal_pt1[5].toNumber() /*data.price*/   , datasetorder.datasetprice,       "check deal (deal.data.price)"  );
		assert.isAtMost (deal_pt1[5].toNumber() /*data.price*/   , requestorder.datasetmaxprice,    "check deal (deal.data.price)"  );

		assert.equal    (deal_pt1[6]            /*pool.pointer*/ , WorkerpoolInstance.address,      "check deal (deal.pool.pointer)");
		if (requestorder.workerpool != constants.NULL.ADDRESS)
		assert.equal    (deal_pt1[6]            /*pool.pointer*/ , requestorder.workerpool,         "check deal (deal.pool.pointer)");
		assert.equal    (deal_pt1[7]            /*pool.owner*/   , scheduler,                       "check deal (deal.pool.owner)"  );
		assert.equal    (deal_pt1[8].toNumber() /*pool.price*/   , workerpoolorder.workerpoolprice, "check deal (deal.pool.price)"  );
		assert.isAtMost (deal_pt1[8].toNumber() /*pool.price*/   , requestorder.workerpoolmaxprice, "check deal (deal.pool.price)"  );

		deal_pt2 = await IexecClerkInstance.viewDealABILegacy_pt2(dealid);
		assert.equal    (deal_pt2[0].toNumber(), workerpoolorder.trust,  "check deal (deal.trust)"      );
		assert.isAtLeast(deal_pt2[0].toNumber(), requestorder.trust,     "check deal (deal.trust)"      );
		assert.equal    (deal_pt2[1],            workerpoolorder.tag,    "check deal (deal.tag)"        );
		assert.equal    (deal_pt2[1],            requestorder.tag,       "check deal (deal.tag)"        );
		assert.equal    (deal_pt2[2],            user,                   "check deal (deal.requester)"  );
		assert.equal    (deal_pt2[3],            user,                   "check deal (deal.beneficiary)");
		assert.equal    (deal_pt2[4],            requestorder.callback,  "check deal (deal.callback)"   );
		assert.equal    (deal_pt2[5],            requestorder.params,    "check deal (deal.params)"     );
	});

	/***************************************************************************
	 *                     TEST: specs are written onchain                     *
	 ***************************************************************************/
	it("[Market] Check config", async () => {
		config = await IexecClerkInstance.viewConfigABILegacy(dealid);
		assert.equal  (config[0].toNumber(), workerpoolorder.category, "check config (config.category)"            );
		assert.equal  (config[0].toNumber(), requestorder.category,    "check config (config.category)"            );
		assert.isAbove(config[1].toNumber(), 0,                        "check config (config.start)"               );
		assert.equal  (config[2].toNumber(), 0,                        "check config (config.botFirst)"            );
		assert.equal  (config[3].toNumber(), 1,                        "check config (config.botSize)"             );
		assert.equal  (config[4].toNumber(), 8,                        "check config (config.workerStake)"         ); // 8 = floor(25*.3)
		assert.equal  (config[5].toNumber(), 5,                        "check config (config.schedulerRewardRatio)");
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("[Market] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                    TEST: scheduler initializes task                     *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(dealid, 0, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		taskid = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.taskid,     taskid,                     "check taskid");
		assert.equal(events[0].args.workerpool, WorkerpoolInstance.address, "check workerpool");
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("[Initialized] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.ACTIVE                                         );
		assert.equal    (task[ 1],            dealid                                                                  );
		assert.equal    (task[ 2].toNumber(), 0                                                                       );
		assert.equal    (task[ 3].toNumber(), (await IexecHubInstance.viewCategoryABILegacy(requestorder.category))[2]);
		assert.isAbove  (task[ 4].toNumber(), 0                                                                       );
		assert.equal    (task[ 5].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 6].toNumber(), 0                                                                       );
		assert.equal    (task[ 7],            constants.NULL.BYTES32                                                  );
		assert.equal    (task[ 8].toNumber(), 0                                                                       );
		assert.equal    (task[ 9].toNumber(), 0                                                                       );
		assert.deepEqual(task[10],            []                                                                      );
		assert.equal    (task[11],            null                                                                    );
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
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

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it(">> Run job", async () => {
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

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it(">> signed contribute", async () => {
		for (w of workers)
		{
			txMined = await IexecHubInstance.contribute(
				authorizations[w.address].taskid, // task (authorization)
				results[w.address].hash,          // common    (result)
				results[w.address].seal,          // unique    (result)
				w.enclave,                        // address   (enclave)
				results[w.address].sign,          // signature (enclave)
				authorizations[w.address].sign,   // signature (authorization)
				{ from: w.address }
			);

			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			events = extractEvents(txMined, IexecHubInstance.address, "TaskContribute");
			assert.equal(events[0].args.taskid, authorizations[w.address].taskid, "check taskid");
			assert.equal(events[0].args.worker, w.address,                        "check worker");
			assert.equal(events[0].args.hash,   results[w.address].hash,          "check hash");
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed] Check contribution", async () => {
		for (w of workers)
		{
			contribution = await IexecHubInstance.viewContributionABILegacy(taskid, w.address);
			assert.equal(contribution[0],            constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution[1],            results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
			assert.equal(contribution[2],            results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
			assert.equal(contribution[3],            w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  992,  8 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  992,  8 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Contributed] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.REVEALING                                      );
		assert.equal    (task[ 1],            dealid                                                                  );
		assert.equal    (task[ 2].toNumber(), 0                                                                       );
		assert.equal    (task[ 3].toNumber(), (await IexecHubInstance.viewCategoryABILegacy(requestorder.category))[2]);
		assert.isAbove  (task[ 4].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 5].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 6].toNumber(), 0                                                                       );
		assert.equal    (task[ 7],            consensus.hash                                                          );
		assert.equal    (task[ 8].toNumber(), 0                                                                       );
		assert.equal    (task[ 9].toNumber(), workers.length                                                          );
		assert.deepEqual(task[10],            workers.map(x => x.address)                                             );
		assert.equal    (task[11],            null                                                                    );
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (w of workers)
		if (results[w.address].hash == consensus.hash)
		{
			txMined = await IexecHubInstance.reveal(
				taskid,
				results[w.address].digest,
				{ from: w.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskReveal");
			assert.equal(events[0].args.taskid, taskid,                    "check taskid");
			assert.equal(events[0].args.worker, w.address,                 "check worker");
			assert.equal(events[0].args.digest, results[w.address].digest, "check digest");
		}
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Reveal] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.REVEALING                                      );
		assert.equal    (task[ 1],            dealid                                                                  );
		assert.equal    (task[ 2].toNumber(), 0                                                                       );
		assert.equal    (task[ 3].toNumber(), (await IexecHubInstance.viewCategoryABILegacy(requestorder.category))[2]);
		assert.isAbove  (task[ 4].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 5].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 6].toNumber(), 0                                                                       );
		assert.equal    (task[ 7],            consensus.hash                                                          );
		assert.equal    (task[ 8].toNumber(), workers.length                                                          );
		assert.equal    (task[ 9].toNumber(), workers.length                                                          );
		assert.deepEqual(task[10],            workers.map(x => x.address)                                             );
		assert.equal    (task[11],            null                                                                    );
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork", async () => {
		txMined = await IexecHubInstance.finalize(
			taskid,
			web3.utils.utf8ToHex("aResult"),
			{ from: scheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  taskid,                          "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"), "check consensus (results)");

		// TODO: check 2 events by w.address for w in workers
		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized] Check task", async () => {
		task = await IexecHubInstance.viewTaskABILegacy(taskid);
		assert.equal    (task[ 0].toNumber(), constants.TaskStatusEnum.COMPLETED                                      );
		assert.equal    (task[ 1],            dealid                                                                  );
		assert.equal    (task[ 2].toNumber(), 0                                                                       );
		assert.equal    (task[ 3].toNumber(), (await IexecHubInstance.viewCategoryABILegacy(requestorder.category))[2]);
		assert.isAbove  (task[ 4].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 5].toNumber(), 0                                                                       );
		assert.isAbove  (task[ 6].toNumber(), 0                                                                       );
		assert.equal    (task[ 7],            consensus.hash                                                          );
		assert.equal    (task[ 8].toNumber(), workers.length                                                          );
		assert.equal    (task[ 9].toNumber(), workers.length                                                          );
		assert.deepEqual(task[10],            workers.map(x => x.address)                                             );
		assert.equal    (task[11],            web3.utils.utf8ToHex("aResult")                                         );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    1, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [    3, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1003, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1011, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1011, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ balance[0].toNumber(), balance[1].toNumber() ], [  971, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
	});

	it("FINISHED", async () => {});

});
