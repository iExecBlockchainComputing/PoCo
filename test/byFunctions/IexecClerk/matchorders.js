var RLC          = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Relay        = artifacts.require("./Relay.sol");
var Broker       = artifacts.require("./Broker.sol");

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

const wallets   = require('../../wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let poolWorker4   = accounts[7];
	let user          = accounts[8];
	let sgxEnclave    = accounts[9];

	var RLCInstance          = null;
	var IexecHubInstance     = null;
	var IexecClerkInstance   = null;
	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;
	var RelayInstance        = null;
	var BrokerInstance       = null;

	var DappInstance = null;
	var DataInstance = null;
	var PoolInstance = null;

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance          = await RLC.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		RelayInstance        = await Relay.deployed();
		BrokerInstance       = await Broker.deployed();

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
			RLCInstance.transfer(dappProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(dataProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolScheduler, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker1,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker2,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker3,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker4,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,          1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
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
			RLCInstance.balanceOf(dappProvider),
			RLCInstance.balanceOf(dataProvider),
			RLCInstance.balanceOf(poolScheduler),
			RLCInstance.balanceOf(poolWorker1),
			RLCInstance.balanceOf(poolWorker2),
			RLCInstance.balanceOf(poolWorker3),
			RLCInstance.balanceOf(poolWorker4),
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
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
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
			IexecClerkInstance.deposit(100000, { from: poolScheduler }),
			IexecClerkInstance.deposit(100000, { from: poolWorker1   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker2   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker3   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker4   }),
			IexecClerkInstance.deposit(100000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);

		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);

		txMined = await PoolRegistryInstance.createPool(poolScheduler, "A test workerpool", /* lock*/ 10, /* minimum stake*/ 10, /* minimum score*/ 10, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);

		txMined = await PoolInstance.changePoolPolicy(35, 5, 100, 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});


	matchOrders = (dappextra, dataextra, poolextra, userextra) => {
		_dapporder = {
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				tag:          0x0,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
		};
		_dataorder = {
			data:         DataInstance.address,
			dataprice:    1,
			volume:       1000,
			tag:          0x0,
			dapprestrict: constants.NULL.ADDRESS,
			poolrestrict: constants.NULL.ADDRESS,
			userrestrict: constants.NULL.ADDRESS,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		_poolorder = {
			pool:         PoolInstance.address,
			poolprice:    25,
			volume:       1000,
			tag:          0x0,
			category:     4,
			trust:        1000,
			dapprestrict: constants.NULL.ADDRESS,
			datarestrict: constants.NULL.ADDRESS,
			userrestrict: constants.NULL.ADDRESS,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		_userorder = {
			dapp:         DappInstance.address,
			dappmaxprice: 3,
			data:         DataInstance.address,
			datamaxprice: 1,
			pool:         constants.NULL.ADDRESS,
			poolmaxprice: 25,
			volume:       1,
			tag:          0x0,
			category:     4,
			trust:        1000,
			requester:    user,
			beneficiary:  user,
			callback:     constants.NULL.ADDRESS,
			params:       "<parameters>",
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		for (key in dappextra) _dapporder[key] = dappextra[key];
		for (key in dataextra) _dataorder[key] = dataextra[key];
		for (key in poolextra) _poolorder[key] = poolextra[key];
		for (key in userextra) _userorder[key] = userextra[key];
		odbtools.signDappOrder(_dapporder, wallets.addressToPrivate(dappProvider));
		odbtools.signDataOrder(_dataorder, wallets.addressToPrivate(dataProvider));
		odbtools.signPoolOrder(_poolorder, wallets.addressToPrivate(poolScheduler));
		odbtools.signUserOrder(_userorder, wallets.addressToPrivate(user));
		return IexecClerkInstance.matchOrders(_dapporder, _dataorder, _poolorder, _userorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
	};



	it("[Match - dapp-data-pool-user]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{},
		);

		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(_userorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(_userorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.dapp.pointer, DappInstance.address  );
		assert.equal(       deal.dapp.owner,   dappProvider          );
		assert.equal(Number(deal.dapp.price),  3                     );
		assert.equal(       deal.data.pointer, DataInstance.address  );
		assert.equal(       deal.data.owner,   dataProvider          );
		assert.equal(Number(deal.data.price),  1                     );
		assert.equal(       deal.pool.pointer, PoolInstance.address  );
		assert.equal(       deal.pool.owner,   poolScheduler         );
		assert.equal(Number(deal.pool.price),  25                    );
		assert.equal(Number(deal.trust),       1000                  );
		assert.equal(Number(deal.tag),         0x0                   );
		assert.equal(       deal.requester,    user                  );
		assert.equal(       deal.beneficiary,  user                  );
		assert.equal(       deal.callback,     constants.NULL.ADDRESS);
		assert.equal(       deal.params,       "<parameters>"        );

		config = await IexecClerkInstance.viewConfig(deals[0]);
		assert.equal  (Number(config.category),             4);
		assert.isAbove(Number(config.startTime),            0);
		assert.equal  (Number(config.botFirst),             0);
		assert.equal  (Number(config.botSize),              1);
		assert.equal  (Number(config.workerStake),          8); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5);
	});

	it("[Match - dapp-pool-user]", async () => {
		await matchOrders(
			{},
			constants.NULL.DATAORDER,
			{},
			{ data: constants.NULL.ADDRESS },
		);

		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(_userorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(_userorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.dapp.pointer, DappInstance.address  );
		assert.equal(       deal.dapp.owner,   dappProvider          );
		assert.equal(Number(deal.dapp.price),  3                     );
		assert.equal(       deal.data.pointer, constants.NULL.ADDRESS);
		assert.equal(       deal.data.owner,   constants.NULL.ADDRESS);
		assert.equal(Number(deal.data.price),  0                     );
		assert.equal(       deal.pool.pointer, PoolInstance.address  );
		assert.equal(       deal.pool.owner,   poolScheduler         );
		assert.equal(Number(deal.pool.price),  25                    );
		assert.equal(Number(deal.trust),       1000                  );
		assert.equal(Number(deal.tag),         0x0                   );
		assert.equal(       deal.requester,    user                  );
		assert.equal(       deal.beneficiary,  user                  );
		assert.equal(       deal.callback,     constants.NULL.ADDRESS);
		assert.equal(       deal.params,       "<parameters>"        );

		config = await IexecClerkInstance.viewConfig(deals[0]);
		assert.equal  (Number(config.category),             4);
		assert.isAbove(Number(config.startTime),            0);
		assert.equal  (Number(config.botFirst),             0);
		assert.equal  (Number(config.botSize),              1);
		assert.equal  (Number(config.workerStake),          8); // 8 = floor(25*.3)
		assert.equal  (Number(config.schedulerRewardRatio), 5);
	});

	it("[Match - dapp-data-pool-user BOT]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{ volume: 10 },
		);

		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(_userorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(_userorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecClerkInstance.viewDeal(deals[0]);
		assert.equal(       deal.dapp.pointer, DappInstance.address  );
		assert.equal(       deal.dapp.owner,   dappProvider          );
		assert.equal(Number(deal.dapp.price),  3                     );
		assert.equal(       deal.data.pointer, DataInstance.address  );
		assert.equal(       deal.data.owner,   dataProvider          );
		assert.equal(Number(deal.data.price),  1                     );
		assert.equal(       deal.pool.pointer, PoolInstance.address  );
		assert.equal(       deal.pool.owner,   poolScheduler         );
		assert.equal(Number(deal.pool.price),  25                    );
		assert.equal(Number(deal.trust),       1000                  );
		assert.equal(Number(deal.tag),         0x0                   );
		assert.equal(       deal.requester,    user                  );
		assert.equal(       deal.beneficiary,  user                  );
		assert.equal(       deal.callback,     constants.NULL.ADDRESS);
		assert.equal(       deal.params,       "<parameters>"        );

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

	it("[Match - Error - dappprice]", async () => {
		try {
			await matchOrders(
				{ dappprice: 1000 },
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

	it("[Match - Error - dataprice]", async () => {
		try {
			await matchOrders(
				{},
				{ dataprice: 1000 },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - poolprice]", async () => {
		try {
			await matchOrders(
				{},
				{},
				{ poolprice: 1000 },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - dapptag]", async () => {
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

	it("[Match - Error - datatag]", async () => {
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

	it("[Match - Ok - pooltag]", async () => {
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

	it("[Match - Error - requested dapp]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ dapp: user },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - requested data]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ data: user},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - poolrequest]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{},
				{ pool: user },
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[Match - Error - dapp-datarestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ datarestrict: user },
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
	it("[Match - Ok - dapp-datarestrict]", async () => {
		txMined = await matchOrders(
			{ datarestrict: DataInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - dapp-poolrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ poolrestrict: user },
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
	it("[Match - Ok - dapp-poolrestrict]", async () => {
		txMined = await matchOrders(
			{ poolrestrict: PoolInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - dapp-userrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{ userrestrict: iexecAdmin },
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
	it("[Match - Ok - dapp-userrestrict]", async () => {
		txMined = await matchOrders(
			{ userrestrict: user },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - data-dapprestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ dapprestrict: user },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - data-dapprestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ dapprestrict: DappInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - dapp-poolrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ poolrestrict: user },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - dapp-poolrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ poolrestrict: PoolInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - dapp-userrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{ userrestrict: iexecAdmin },
				{},
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - dapp-userrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{ userrestrict: user },
			{},
			{},
		);
	});

	it("[Match - Error - pool-dapprestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ dapprestrict: user },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - pool-dapprestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ dapprestrict: DappInstance.address },
			{},
		);
	});

	it("[Match - Error - pool-datarestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ datarestrict: user },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - pool-datarestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ datarestrict: DataInstance.address },
			{},
		);
	});

	it("[Match - Error - pool-userrestrict]", async () => {
		try {
			txMined = await matchOrders(
				{},
				{},
				{ userrestrict: iexecAdmin },
				{},
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});
	it("[Match - Ok - pool-userrestrict]", async () => {
		txMined = await matchOrders(
			{},
			{},
			{ userrestrict: user },
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
