var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");
var Relay              = artifacts.require("./Relay.sol");
var Broker             = artifacts.require("./Broker.sol");

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
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;
	var RelayInstance              = null;
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

	var totalgas = 0;

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
		RelayInstance              = await Relay.deployed();
		BrokerInstance             = await Broker.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		console.log("EIP712DOMAIN_TYPEHASH:   ", odbtools.EIP712DOMAIN_TYPEHASH   );
		console.log("APPORDER_TYPEHASH:       ", odbtools.APPORDER_TYPEHASH       );
		console.log("DATASETORDER_TYPEHASH:   ", odbtools.DATASETORDER_TYPEHASH   );
		console.log("WORKERPOOLORDER_TYPEHASH:", odbtools.WORKERPOOLORDER_TYPEHASH);
		console.log("REQUESTORDER_TYPEHASH:   ", odbtools.REQUESTORDER_TYPEHASH   );

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
			RLCInstance.transfer(worker5,         1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
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
		assert.isBelow(txsMined[8].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(appProvider),
			RLCInstance.balanceOf(datasetProvider),
			RLCInstance.balanceOf(scheduler),
			RLCInstance.balanceOf(worker1),
			RLCInstance.balanceOf(worker2),
			RLCInstance.balanceOf(worker3),
			RLCInstance.balanceOf(worker4),
			RLCInstance.balanceOf(worker5),
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
		assert.equal(balances[8], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker1,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker2,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker3,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker4,         gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: worker5,         gas: constants.AMOUNT_GAS_PROVIDED }),
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
		assert.isBelow(txsMined[8].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                   TEST: App creation (by appProvider)                   *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);
	});

	/***************************************************************************
	 *               TEST: Dataset creation (by datasetProvider)               *
	 ***************************************************************************/
	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
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
				tag:                0x0,
				datasetrestrict:    constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(appProvider)
		);
		assert.isTrue(
			await IexecClerkInstance.verify(
				appProvider,
				odbtools.AppOrderStructHash(apporder),
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
				tag:                0x0,
				apprestrict:        constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(datasetProvider)
		);
		assert.isTrue(
			await IexecClerkInstance.verify(
				datasetProvider,
				odbtools.DatasetOrderStructHash(datasetorder),
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
				tag:               0x0,
				apprestrict:       constants.NULL.ADDRESS,
				datasetrestrict:   constants.NULL.ADDRESS,
				requesterrestrict: constants.NULL.ADDRESS,
				salt:              web3.utils.randomHex(32),
				sign:              constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(scheduler)
		);
		assert.isTrue(
			await IexecClerkInstance.verify(
				scheduler,
				odbtools.WorkerpoolOrderStructHash(workerpoolorder),
				workerpoolorder.sign,
				{}
			),
			"Error with the validation of the.workerpoolorder signature"
		);
	});

	/***************************************************************************
	 *                 TEST: Request order signature (by user)                 *
	 ***************************************************************************/
	it("[Genesis] Generate request order", async () => {
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
				tag:                0x0,
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
			await IexecClerkInstance.verify(
				user,
				odbtools.RequestOrderStructHash(requestorder),
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
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker5,   gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: user,      gas: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(extractEvents(txsMined[0], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[1], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[2], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[3], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[4], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[5], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		assert.equal(extractEvents(txsMined[6], IexecClerkInstance.address, "Deposit")[0].args.amount, 1000);
		// assert.equal(txsMined[0].events.Deposit.returnValues.owner,  scheduler, "check deposit recipient");
		// assert.equal(txsMined[1].events.Deposit.returnValues.owner,  worker1,   "check deposit recipient");
		// assert.equal(txsMined[2].events.Deposit.returnValues.owner,  worker2,   "check deposit recipient");
		// assert.equal(txsMined[3].events.Deposit.returnValues.owner,  worker3,   "check deposit recipient");
		// assert.equal(txsMined[4].events.Deposit.returnValues.owner,  worker4,   "check deposit recipient");
		// assert.equal(txsMined[5].events.Deposit.returnValues.owner,  worker5,   "check deposit recipient");
		// assert.equal(txsMined[6].events.Deposit.returnValues.owner,  user,      "check deposit recipient");
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Setup] Check balances", async () => {
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker5)), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		totalgas += txMined.receipt.gasUsed;

		dealid = web3.utils.soliditySha3(
			{ t: 'bytes32', v: odbtools.RequestOrderStructHash(requestorder) },
			{ t: 'uint256', v: 0                                             },
		);

		events = extractEvents(txMined, IexecClerkInstance.address, "SchedulerNotice");
		assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
		assert.equal(events[0].args.dealid,     dealid                    );

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.dealid,         dealid                                             );
		assert.equal(events[0].args.appHash,        odbtools.AppOrderStructHash       (apporder       ));
		assert.equal(events[0].args.datasetHash,    odbtools.DatasetOrderStructHash   (datasetorder   ));
		assert.equal(events[0].args.workerpoolHash, odbtools.WorkerpoolOrderStructHash(workerpoolorder));
		assert.equal(events[0].args.requestHash,    odbtools.RequestOrderStructHash   (requestorder   ));
		assert.equal(events[0].args.volume,         1                                                  );
	});

	/***************************************************************************
	 *                      TEST: deal is written onchain                      *
	 ***************************************************************************/
	it("[Market] Check deal", async () => {
		deal = await IexecClerkInstance.viewDeal(dealid);
		assert.equal    (       deal.app.pointer,        AppInstance.address,             "check deal (deal.app.pointer)"       );
		assert.equal    (       deal.app.owner,          appProvider,                     "check deal (deal.app.owner)"         );
		assert.equal    (Number(deal.app.price),         apporder.appprice,               "check deal (deal.app.price)"         );
		assert.equal    (       deal.app.pointer,        requestorder.app,                "check deal (deal.app.pointer)"       );
		assert.isAtMost (Number(deal.app.price),         requestorder.appmaxprice,        "check deal (deal.app.price)"         );
		assert.equal    (       deal.dataset.pointer,    DatasetInstance.address,         "check deal (deal.dataset.pointer)"   );
		assert.equal    (       deal.dataset.owner,      datasetProvider,                 "check deal (deal.dataset.owner)"     );
		assert.equal    (Number(deal.dataset.price),     datasetorder.datasetprice,       "check deal (deal.dataset.price)"     );
		assert.equal    (       deal.dataset.pointer,    requestorder.dataset,            "check deal (deal.dataset.pointer)"   );
		assert.isAtMost (Number(deal.dataset.price),     requestorder.datasetmaxprice,    "check deal (deal.dataset.price)"     );
		assert.equal    (       deal.workerpool.pointer, WorkerpoolInstance.address,      "check deal (deal.workerpool.pointer)");
		assert.equal    (       deal.workerpool.owner,   scheduler,                       "check deal (deal.workerpool.owner)"  );
		assert.equal    (Number(deal.workerpool.price),  workerpoolorder.workerpoolprice, "check deal (deal.workerpool.price)"  );
		if( requestorder.workerpool != constants.NULL.ADDRESS)
		assert.equal    (       deal.workerpool.pointer, requestorder.workerpool,         "check deal (deal.workerpool.pointer)");
		assert.isAtMost (Number(deal.workerpool.price),  requestorder.workerpoolmaxprice, "check deal (deal.workerpool.price)"  );
		assert.equal    (Number(deal.trust),             workerpoolorder.trust,           "check deal (deal.trust)"             );
		assert.isAtLeast(Number(deal.trust),             requestorder.trust,              "check deal (deal.trust)"             );
		assert.equal    (Number(deal.tag),               workerpoolorder.tag,             "check deal (deal.tag)"               );
		assert.equal    (Number(deal.tag),               requestorder.tag,                "check deal (deal.tag)"               );
		assert.equal    (       deal.requester,          user,                            "check deal (deal.requester)"         );
		assert.equal    (       deal.beneficiary,        user,                            "check deal (deal.beneficiary)"       );
		assert.equal    (       deal.callback,           requestorder.callback,           "check deal (deal.callback)"          );
		assert.equal    (       deal.params,             requestorder.params,             "check deal (deal.params)"            );
	});

	/***************************************************************************
	 *                     TEST: specs are written onchain                     *
	 ***************************************************************************/
	it("[Market] Check config", async () => {
		config = await IexecClerkInstance.viewConfig(dealid);
		assert.equal  (Number(config.category            ), workerpoolorder.category, "check config (config.category)"            );
		assert.equal  (Number(config.category            ), requestorder.category,    "check config (config.category)"            );
		assert.isAbove(Number(config.startTime           ), 0,                        "check config (config.start)"               );
		assert.equal  (Number(config.botFirst            ), 0,                        "check config (config.botFirst)"            );
		assert.equal  (Number(config.botSize             ), 1,                        "check config (config.botSize)"             );
		assert.equal  (Number(config.workerStake         ), 8,                        "check config (config.workerStake)"         ); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5,                        "check config (config.schedulerRewardRatio)");
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 1                     *
	 ***************************************************************************/
	it("[Market] Check balances", async () => {
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                    TEST: scheduler initializes task                     *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(dealid, 0, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		totalgas += txMined.receipt.gasUsed;

		taskid = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.taskid,     taskid                    );
		assert.equal(events[0].args.workerpool, WorkerpoolInstance.address);
	});

	/***************************************************************************
	 *                  TEST: work order has been initialized                  *
	 ***************************************************************************/
	it("[Initialized] Check task", async () => {
		task = await IexecHubInstance.viewTask(taskid);
		assert.equal    (       task.status,             constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (       task.dealid,             dealid,                          "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),               0,                               "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,     constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline), 0,                               "check task (task.consensusDeadline)");
		assert.equal    (Number(task.revealDeadline),    0,                               "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),     0,                               "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),     0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors,       [],                              "check task (task.contributors)"     );
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
	it(">> signed contribute 1/2", async () => {
		w = workers[0]
		// for (w of workers)
		{
			txMined = await IexecHubInstance.contribute(
				authorizations[w.address].taskid,  // task (authorization)
				results[w.address].hash,           // common    (result)
				results[w.address].seal,           // unique    (result)
				authorizations[w.address].enclave, // address   (enclave)
				results[w.address].sign,           // signature (enclave)
				authorizations[w.address].sign,    // signature (authorization)
				{ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskContribute");
			assert.equal(events[0].args.taskid, authorizations[w.address].taskid);
			assert.equal(events[0].args.worker, w.address                       );
			assert.equal(events[0].args.hash,   results[w.address].hash         );

			totalgas += txMined.receipt.gasUsed;
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed 1/2] Check contribution", async () => {
		w = workers[0]
		// for (w of workers)
		{
			contribution = await IexecHubInstance.viewContribution(taskid, w.address);
			assert.equal(contribution.status,           constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution.resultHash,       results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
			assert.equal(contribution.resultSeal,       results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
			assert.equal(contribution.enclaveChallenge, w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed 1/2] Check balances", async () => {
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  992,  8 ], "check balance"));
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Contributed 1/2] Check task", async () => {
		task = await IexecHubInstance.viewTask(taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.ACTIVE, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                          "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                               "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           constants.NULL.BYTES32,          "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                               "check task (task.consensusDeadline)");
		assert.equal    (Number(task.revealDeadline),          0,                               "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           0,                               "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           0,                               "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), [ workers[0].address ],          "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it(">> signed contribute 2/2", async () => {
		w = workers[1]
		// for (w of workers)
		{
			txMined = await IexecHubInstance.contribute(
				authorizations[w.address].taskid, // task (authorization)
				results[w.address].hash,          // common    (result)
				results[w.address].seal,          // unique    (result)
				w.enclave,                        // address   (enclave)
				results[w.address].sign,          // signature (enclave)
				authorizations[w.address].sign,   // signature (authorization)
				{ from: w.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskContribute");
			assert.equal(events[0].args.taskid, authorizations[w.address].taskid);
			assert.equal(events[0].args.worker, w.address                       );
			assert.equal(events[0].args.hash,   results[w.address].hash         );

			events = extractEvents(txMined, IexecHubInstance.address, "TaskConsensus");
			assert.equal(events[0].args.taskid,    taskid        );
			assert.equal(events[0].args.consensus, consensus.hash);

			totalgas += txMined.receipt.gasUsed;
		}
	});

	/***************************************************************************
	 *                   TEST: contribution has been filled                    *
	 ***************************************************************************/
	it("[Contributed 2/2] Check contribution", async () => {
		w = workers[1]
		// for (w of workers)
		{
			contribution = await IexecHubInstance.viewContribution(taskid, w.address);
			assert.equal(contribution.status,           constants.ContributionStatusEnum.CONTRIBUTED, "check contribution (contribution.status)"          );
			assert.equal(contribution.resultHash,       results[w.address].hash,                      "check contribution (contribution.resultHash)"      );
			assert.equal(contribution.resultSeal,       results[w.address].seal,                      "check contribution (contribution.resultSeal)"      );
			assert.equal(contribution.enclaveChallenge, w.enclave,                                    "check contribution (contribution.enclaveChallenge)");
		}
	});

	/***************************************************************************
	 *                     TEST: check balances - locked 2                     *
	 ***************************************************************************/
	it("[Contributed 2/2] Check balances", async () => {
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  993,  7 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  992,  8 ], "check balance"));
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  992,  8 ], "check balance"));
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971, 29 ], "check balance"));
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Contributed 2/2] Check task", async () => {
		task = await IexecHubInstance.viewTask(taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           0,                                  "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
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
			assert.equal(events[0].args.taskid, taskid                   );
			assert.equal(events[0].args.worker, w.address                );
			assert.equal(events[0].args.digest, results[w.address].digest);

			totalgas += txMined.receipt.gasUsed;
		}
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Reveal] Check task", async () => {
		task = await IexecHubInstance.viewTask(taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.REVEALING, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork", async () => {
		txMined = await IexecHubInstance.finalize(taskid, web3.utils.utf8ToHex("aResult"), { from: scheduler, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  taskid                         );
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult"));

		totalgas += txMined.receipt.gasUsed;

		// TODO: check 2 events by w.address for w in workers
		// How to retreive events from the IexecClerk (5 rewards and 1 seize)
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized] Check task", async () => {
		task = await IexecHubInstance.viewTask(taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED, "check task (task.status)"           );
		assert.equal    (       task.dealid,                   dealid,                             "check task (task.dealid)"           );
		assert.equal    (Number(task.idx),                     0,                                  "check task (task.idx)"              );
		assert.equal    (       task.consensusValue,           consensus.hash,                     "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                  "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                  "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           workers.length,                     "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           workers.length,                     "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), workers.map(x => x.address),        "check task (task.contributors)"     );
		assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized] Check balances", async () => {
		IexecClerkInstance.viewAccount(datasetProvider).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    1,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(appProvider    ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    3,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(scheduler      ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1003,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker1        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1011,  0 ], "check balance")); // +11
		IexecClerkInstance.viewAccount(worker2        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1011,  0 ], "check balance")); // +11
		IexecClerkInstance.viewAccount(worker3        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker5        ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance"));
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  971,  0 ], "check balance"));
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(worker1)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker2)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker4)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(worker5)), 0, "score issue");
	});

	it("FINISHED", async () => {
		console.log("Total gas:", totalgas);
	});

});
