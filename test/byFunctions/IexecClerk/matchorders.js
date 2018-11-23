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

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

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
			IexecClerkInstance.deposit(100000, { from: scheduler }),
			IexecClerkInstance.deposit(100000, { from: worker1   }),
			IexecClerkInstance.deposit(100000, { from: worker2   }),
			IexecClerkInstance.deposit(100000, { from: worker3   }),
			IexecClerkInstance.deposit(100000, { from: worker4   }),
			IexecClerkInstance.deposit(100000, { from: user      }),
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
	it("[Setup]", async () => {
		// Ressources
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);

		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance = await Dataset.at(events[0].args.dataset);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A test workerpool", 10, 10, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);

		txMined = await WorkerpoolInstance.changePolicy(35, 5, 100, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});


	matchOrders = (appextra, datasetextra, workerpoolextra, userextra) => {
		_apporder = {
				app:                AppInstance.address,
				appprice:           3,
				volume:             1000,
				tag:                0x0,
				datasetrestrict:    constants.NULL.ADDRESS,
				workerpoolrestrict: constants.NULL.ADDRESS,
				requesterrestrict:  constants.NULL.ADDRESS,
				salt:               web3.utils.randomHex(32),
				sign:               constants.NULL.SIGNATURE,
		};
		_datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       1,
			volume:             1000,
			tag:                0x0,
			apprestrict:        constants.NULL.ADDRESS,
			workerpoolrestrict: constants.NULL.ADDRESS,
			requesterrestrict:  constants.NULL.ADDRESS,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		_workerpoolorder = {
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            1000,
			tag:               0x0,
			category:          4,
			trust:             1000,
			apprestrict:       constants.NULL.ADDRESS,
			datasetrestrict:   constants.NULL.ADDRESS,
			requesterrestrict: constants.NULL.ADDRESS,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		};
		_requestorder = {
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         constants.NULL.ADDRESS,
			workerpoolmaxprice: 25,
			volume:             1,
			tag:                0x0,
			category:           4,
			trust:              1000,
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "<parameters>",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		for (key in appextra       ) _apporder[key]        = appextra[key];
		for (key in datasetextra   ) _datasetorder[key]    = datasetextra[key];
		for (key in workerpoolextra) _workerpoolorder[key] = workerpoolextra[key];
		for (key in userextra      ) _requestorder[key]       = userextra[key];
		odbtools.signAppOrder       (_apporder,        wallets.addressToPrivate(appProvider    ));
		odbtools.signDatasetOrder   (_datasetorder,    wallets.addressToPrivate(datasetProvider));
		odbtools.signWorkerpoolOrder(_workerpoolorder, wallets.addressToPrivate(scheduler      ));
		odbtools.signRequestOrder   (_requestorder,    wallets.addressToPrivate(user           ));
		return IexecClerkInstance.matchOrders(_apporder, _datasetorder, _workerpoolorder, _requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
	};



	it("[Match - app-dataset-workerpool-user]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{},
		);

		deals = await IexecClerkInstance.viewRequestDeals(odbtools.RequestOrderStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.app.pointer,        AppInstance.address       );
		assert.equal(       deal.app.owner,          appProvider               );
		assert.equal(Number(deal.app.price),         3                         );
		assert.equal(       deal.dataset.pointer,    DatasetInstance.address   );
		assert.equal(       deal.dataset.owner,      datasetProvider           );
		assert.equal(Number(deal.dataset.price),     1                         );
		assert.equal(       deal.workerpool.pointer, WorkerpoolInstance.address);
		assert.equal(       deal.workerpool.owner,   scheduler                 );
		assert.equal(Number(deal.workerpool.price),  25                        );
		assert.equal(Number(deal.trust),             1000                      );
		assert.equal(Number(deal.tag),               0x0                       );
		assert.equal(       deal.requester,          user                      );
		assert.equal(       deal.beneficiary,        user                      );
		assert.equal(       deal.callback,           constants.NULL.ADDRESS    );
		assert.equal(       deal.params,             "<parameters>"            );

		config = await IexecClerkInstance.viewConfig(deals[0]);
		assert.equal  (Number(config.category),             4);
		assert.isAbove(Number(config.startTime),            0);
		assert.equal  (Number(config.botFirst),             0);
		assert.equal  (Number(config.botSize),              1);
		assert.equal  (Number(config.workerStake),          8); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5);
	});

	it("[Match - app-workerpool-user]", async () => {
		await matchOrders(
			{},
			constants.NULL.DATAORDER,
			{},
			{ dataset: constants.NULL.ADDRESS },
		);

		deals = await IexecClerkInstance.viewRequestDeals(odbtools.RequestOrderStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.app.pointer,        AppInstance.address       );
		assert.equal(       deal.app.owner,          appProvider               );
		assert.equal(Number(deal.app.price),         3                         );
		assert.equal(       deal.dataset.pointer,    constants.NULL.ADDRESS    );
		assert.equal(       deal.dataset.owner,      constants.NULL.ADDRESS    );
		assert.equal(Number(deal.dataset.price),     0                         );
		assert.equal(       deal.workerpool.pointer, WorkerpoolInstance.address);
		assert.equal(       deal.workerpool.owner,   scheduler                 );
		assert.equal(Number(deal.workerpool.price),  25                        );
		assert.equal(Number(deal.trust),             1000                      );
		assert.equal(Number(deal.tag),               0x0                       );
		assert.equal(       deal.requester,          user                      );
		assert.equal(       deal.beneficiary,        user                      );
		assert.equal(       deal.callback,           constants.NULL.ADDRESS    );
		assert.equal(       deal.params,             "<parameters>"            );

		config = await IexecClerkInstance.viewConfig(deals[0]);
		assert.equal  (Number(config.category),             4);
		assert.isAbove(Number(config.startTime),            0);
		assert.equal  (Number(config.botFirst),             0);
		assert.equal  (Number(config.botSize),              1);
		assert.equal  (Number(config.workerStake),          8); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5);
	});

	it("[Match - app-dataset-workerpool-user BOT]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{ volume: 10 },
		);

		deals = await IexecClerkInstance.viewRequestDeals(odbtools.RequestOrderStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.app.pointer,        AppInstance.address       );
		assert.equal(       deal.app.owner,          appProvider               );
		assert.equal(Number(deal.app.price),         3                         );
		assert.equal(       deal.dataset.pointer,    DatasetInstance.address   );
		assert.equal(       deal.dataset.owner,      datasetProvider           );
		assert.equal(Number(deal.dataset.price),     1                         );
		assert.equal(       deal.workerpool.pointer, WorkerpoolInstance.address);
		assert.equal(       deal.workerpool.owner,   scheduler                 );
		assert.equal(Number(deal.workerpool.price),  25                        );
		assert.equal(Number(deal.trust),             1000                      );
		assert.equal(Number(deal.tag),               0x0                       );
		assert.equal(       deal.requester,          user                      );
		assert.equal(       deal.beneficiary,        user                      );
		assert.equal(       deal.callback,           constants.NULL.ADDRESS    );
		assert.equal(       deal.params,             "<parameters>"            );

		config = await IexecClerkInstance.viewConfig(deals[0]);
		assert.equal  (Number(config.category),             4);
		assert.isAbove(Number(config.startTime),            0);
		assert.equal  (Number(config.botFirst),             0);
		assert.equal  (Number(config.botSize),             10);
		assert.equal  (Number(config.workerStake),          8); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5);
	});

	it("[Match - Error - category]", async () => {
		try {
			await matchOrders(
				{},
				{},
				{},
				{ category: 5 },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - trust]", async () => {
		try {
			await matchOrders(
				{},
				{},
				{ trust: 100 },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - appprice]", async () => {
		try {
			await matchOrders(
				{ appprice: 1000 },
				{},
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - datasetprice]", async () => {
		try {
			await matchOrders(
				{},
				{ datasetprice: 1000 },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - workerpoolprice]", async () => {
		try {
			await matchOrders(
				{},
				{},
				{ workerpoolprice: 1000 },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - apptag]", async () => {
		try {
			txMined = await matchOrders(
				{ tag: 0x1 },
				{},
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - datasettag]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ tag: 0x1 },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Ok - workerpooltag]", async () => {
		// try {
			txMined = await matchOrders(
				{},
				{},
				{ tag: 0x1 },
				{},
			);
			// assert.fail("transaction should have reverted");
		// } catch (error) {
			// assert(error, "Expected an error but did not get one");
			// assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		// }
	});

	it("[Match - Error - usertag]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ tag: 0x1 },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - requested app]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ app: user },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - requested dataset]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ dataset: user},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - workerpoolrequest]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ workerpool: user },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - app-datasetrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ datasetrestrict: user },
				{},
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - app-datasetrestrict]", async () => {
		txMined = await matchOrders(
			{ datasetrestrict: DatasetInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - app-workerpoolrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ workerpoolrestrict: user },
				{},
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - app-workerpoolrestrict]", async () => {
		txMined = await matchOrders(
			{ workerpoolrestrict: WorkerpoolInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - app-requesterrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ requesterrestrict: iexecAdmin },
				{},
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		txMined = await matchOrders(
			{ requesterrestrict: user },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - dataset-apprestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ apprestrict: user },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - dataset-apprestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ apprestrict: AppInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - app-workerpoolrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ workerpoolrestrict: user },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - app-workerpoolrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ workerpoolrestrict: WorkerpoolInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - app-requesterrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ requesterrestrict: iexecAdmin },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ requesterrestrict: user },
			{},
			{},
		);
	});

	it("[Match - Error - workerpool-apprestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ apprestrict: user },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - workerpool-apprestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ apprestrict: AppInstance.address },
			{},
		);
	});

	it("[Match - Error - workerpool-datasetrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ datasetrestrict: user },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - workerpool-datasetrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ datasetrestrict: DatasetInstance.address },
			{},
		);
	});

	it("[Match - Error - workerpool-requesterrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ requesterrestrict: iexecAdmin },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - workerpool-requesterrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ requesterrestrict: user },
			{},
		);
	});

	it("[Match - Error - volume null]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ volume: 0},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

});
