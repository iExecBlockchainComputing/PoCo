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

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

const wallets   = require('../../wallets');

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
	var userorder       = null;
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

		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: scheduler,       gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker1,         gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker2,         gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker3,         gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: worker4,         gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstance.deposit(1000, { from: user,            gasLimit: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance        = await App.at(events[0].args.app);
	});

	/***************************************************************************
	 *                  TEST: Dataset creation (by datasetProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance    = await Dataset.at(events[0].args.dataset);
	});

	/***************************************************************************
	 *                 TEST: Workerpool creation (by scheduler)                  *
	 ***************************************************************************/
	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			10, // lock
			10, // minimum stake
			10, // minimum score
			{ from: scheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);
	});

	/***************************************************************************
	 *               TEST: Workerpool configuration (by scheduler)               *
	 ***************************************************************************/
	it("[Genesis] Workerpool Configuration", async () => {
		txMined = await WorkerpoolInstance.changePolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: scheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *              TEST: App order signature (by appProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate app order", async () => {
		apporder = odbtools.signAppOrder(
			{
				app:                AppInstance.address,
				appprice:           3,
				volume:             1000,
				tag:                0,
				datasetrestrict:    constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				userrestrict:       constants.NULL.ADDRESS,
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
	 *              TEST: Dataset order signature (by datasetProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate dataset order", async () => {
		datasetorder = odbtools.signDatasetOrder(
			{
				dataset:            DatasetInstance.address,
				datasetprice:       1,
				volume:             1000,
				tag:                0,
				apprestrict:        constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				userrestrict:       constants.NULL.ADDRESS,
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
	 *              TEST: Workerpool order signature (by workerpoolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate workerpool order", async () => {
		workerpoolorder = odbtools.signWorkerpoolOrder(
			{
				workerpool:      WorkerpoolInstance.address,
				workerpoolprice: 25,
				volume:          3,
				tag:             0,
				category:        4,
				trust:           1000,
				apprestrict:     constants.NULL.ADDRESS,
				datasetrestrict: constants.NULL.ADDRESS,
				userrestrict:    constants.NULL.ADDRESS,
				salt:            web3.utils.randomHex(32),
				sign:            constants.NULL.SIGNATURE,
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
			"Error with the validation of the workerpoolorder signature"
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = odbtools.signUserOrder(
			{
				app:                AppInstance.address,
				appmaxprice:        3,
				dataset:            DatasetInstance.address,
				datasetmaxprice:    1,
				workerpool:         constants.NULL.ADDRESS,
				workerpoolmaxprice: 25,
				volume:             1,
				tag:                0,
				category:           4,
				trust:              1000,
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
				odbtools.UserOrderStructHash(userorder),
				userorder.sign,
				{}
			),
			"Error with the validation of the userorder signature"
		);
	});

	it("broker setup", async () => {

		// txMined = await BrokerInstance.deposit({ value: web3.utils.toWei("1.00", "ether"), from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		txMined = await web3.eth.sendTransaction({
			from:  user,
			to:    BrokerInstance.address,
			value: web3.utils.toWei("1.00", "ether"),
		});
		assert.isBelow(txMined.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		txMined = await BrokerInstance.setPreferences(
			web3.utils.toWei("0.01", "ether"),
			web3.utils.toWei("40.0", "gwei"),
			{ from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		balance     = await BrokerInstance.m_balance(user);
		preferences = await BrokerInstance.m_preferences(user);
		assert.equal(balance, web3.utils.toWei("1.00", "ether"));
		assert.equal(preferences.reward,      web3.utils.toWei("0.01", "ether"));
		assert.equal(preferences.maxgasprice, web3.utils.toWei("40.0", "gwei"));
	});

	it("check before", async () => {
		assert.equal(
			await BrokerInstance.m_balance(user),
			await web3.eth.getBalance(BrokerInstance.address)
		);

		account = await web3.eth.getBalance(sgxEnclave);
		console.log("before:", account / web3.utils.toWei("1.00", "ether"));
	});

	it(">> broker match", async () => {
		// txMined = await IexecClerkInstance.matchOrders(apporder, datasetorder, workerpoolorder, userorder, { from: sgxEnclave, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		txMined = await BrokerInstance.matchOrdersForUser(apporder, datasetorder, workerpoolorder, userorder, { from: sgxEnclave, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// dealid = web3.utils.soliditySha3(
		// 	{ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder) },
		// 	{ t: 'uint256', v: 0                                       },
		// );
		// assert.equal(txMined.events.SchedulerNotice.returnValues.workerpool,   WorkerpoolInstance.address,                    "error");
		// assert.equal(txMined.events.SchedulerNotice.returnValues.dealid, dealid,                                  "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.dealid,   dealid,                                  "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.appHash, odbtools.AppOrderStructHash(apporder), "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.datasetHash, odbtools.DatasetOrderStructHash(datasetorder), "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.workerpoolHash, odbtools.WorkerpoolOrderStructHash(workerpoolorder), "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.userHash, odbtools.UserOrderStructHash(userorder), "error");
		// assert.equal(txMined.events.OrdersMatched.returnValues.volume,   1,                                       "error");
	});

	it("check after", async () => {
		assert.equal(
			await BrokerInstance.m_balance(user),
			await web3.eth.getBalance(BrokerInstance.address)
		);

		account = await web3.eth.getBalance(sgxEnclave);
		console.log("after: ",account / web3.utils.toWei("1.00", "ether"));
	});

	it("broker exit", async () => {
		balance = await BrokerInstance.m_balance(user),

		txMined = await BrokerInstance.withdraw(balance, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await BrokerInstance.m_balance(user), 0);
	});

});
