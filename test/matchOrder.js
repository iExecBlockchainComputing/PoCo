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

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		/*
		RLCInstance          = "0x464f85C10c122230306E943a3FD5700890885246";
		IexecHubInstance     = "0x537C423A919110BcC8C05ecBDa39Ba8d30192061";
		IexecClerkInstance   = "0x08Ea1699CEB1aC2a1b30A238eF58B3FFc871b95d";
		DataRegistryInstance = "0x57D329161189f3DD3d032C76b7C98397FEEcC8ea";
		DappRegistryInstance = "0x2a748e99C4116c29F3f84aad7c3984567287b5F3";
		PoolRegistryInstance = "0x9aF85b827Dd74aAc5cB6DeA0b0ED97A73c6FCCc7";
		RelayInstance        = "0x81Ce57EF7f6d129A38D6Cd13cBCf006732550059";
		BrokerInstance       = "0x24EeD66326c190950F9d9581682d08F35b6C7ed3";
		*/
		IexecClerkInstance         = await IexecClerk.at("0x537C423A919110BcC8C05ecBDa39Ba8d30192061");
		RLCInstance                = await RLC.at(await IexecClerkInstance.rlc());
		IexecHubInstance           = await IexecHub.at(await IexecClerkInstance.iexechub());
		AppRegistryInstance        = await AppRegistry.at(await IexecHubInstance.appregistry());
		DatasetRegistryInstance    = await DatasetRegistry.at(await IexecHubInstance.datasetregistry());
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.at(await IexecHubInstance.workerpoolregistry());

		console.log("IexecHubInstance address *********: ", IexecHubInstance.address);
		console.log("IexecClerkInstance address *********: ", IexecClerkInstance.address);

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
		assert.equal(balances[0].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[1].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[2].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[3].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[4].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[5].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[6].toNumber(), 1000000000, "1000000000 nRLC here");
		assert.equal(balances[7].toNumber(), 1000000000, "1000000000 nRLC here");

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
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance        = await App.at(events[0].args.app);
	});

	/***************************************************************************
	 *               TEST: Dataset creation (by datasetProvider)               *
	 ***************************************************************************/
	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance    = await Dataset.at(events[0].args.dataset);
	});

	/***************************************************************************
	 *                TEST: Workerpool creation (by scheduler)                 *
	 ***************************************************************************/
	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			10, // lock
			10, // minimum stake
			{ from: scheduler }
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
			100, // minimum stake
			{ from: scheduler }
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
				trust:             0,
				tag:               0x0,
				apprestrict:       constants.NULL.ADDRESS,
				datasetrestrict:   constants.NULL.ADDRESS,
				requesterrestrict: constants.NULL.ADDRESS,
				salt:              web3.utils.randomHex(32),
				sign:              constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(scheduler)
		);
	});

	/***************************************************************************
	 *                 TEST: Requestorder signature (by user)                  *
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
				trust:              0,
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
	});

	it("[LOG] show order", async () => {
		// console.log("=== dapporder ===");
		// console.log(dapporder);
		// console.log("=== dataorder ===");
		// console.log(dataorder);
		// console.log("=== poolorder ===");
		// console.log(poolorder);
		// console.log("=== requestorder ===");
		// console.log(requestorder);
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
		IexecClerkInstance.viewAccount(user           ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: scheduler, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker1,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker2,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker3,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker4,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: user,      gasLimit: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Setup] Check balances", async () => {
		IexecClerkInstance.viewAccountABILegacy(datasetProvider).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(appProvider    ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [    0, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(scheduler      ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker1        ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker2        ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker3        ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(worker4        ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstance.viewAccountABILegacy(user           ).then(balance => assert.deepEqual([ Number(balance[0]), Number(balance[1]) ], [ 1000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

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
		assert.equal(events[0].args.userHash,       odbtools.RequestOrderStructHash   (requestorder   ));
		assert.equal(events[0].args.volume,         1                                                  );
	});


});
