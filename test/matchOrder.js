var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
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

const Web3      = require('web3')
const constants = require("./constants");
const odbtools  = require('../utils/odb-tools');

const wallets   = require('./wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[2];
	let dataProvider  = accounts[3];
	let poolScheduler = accounts[9];
	let poolWorker1   = accounts[1];
	let poolWorker2   = accounts[6];
	let poolWorker3   = accounts[7];
	let poolWorker4   = accounts[8];
	let user          = accounts[4];
	let sgxEnclave    = accounts[5];


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

	var dapporder = null;
	var dataorder = null;
	var poolorder = null;
	var userorder = null;
	var dealid    = null;
	var taskid    = null;

	var authorizations = {};
	var results        = {};
	var consensus      = null;
	var workers        = [];

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
		IexecClerkInstance   = await IexecClerk.at("0x08Ea1699CEB1aC2a1b30A238eF58B3FFc871b95d");
		RLCInstance          = await RLC.at(await IexecClerkInstance.rlc());
		IexecHubInstance     = await IexecHub.at(await IexecClerkInstance.iexechub());
		DappRegistryInstance = await DappRegistry.at(await IexecHubInstance.dappregistry());
		DataRegistryInstance = await DataRegistry.at(await IexecHubInstance.dataregistry());
		PoolRegistryInstance = await PoolRegistry.at(await IexecHubInstance.poolregistry());

		console.log("IexecHubInstance address *********: ", IexecHubInstance.address);
		console.log("IexecClerkInstance address *********: ", IexecClerkInstance.address);


		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * For ABIEncoderV2
		 */
		web3 = new Web3(web3.currentProvider);
		IexecHubInstanceBeta   = new web3.eth.Contract(IexecHubInstance.abi,   IexecHubInstance.address  );
		IexecClerkInstanceBeta = new web3.eth.Contract(IexecClerkInstance.abi, IexecClerkInstance.address);

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
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("[Genesis] Pool Creation", async () => {
		txMined = await PoolRegistryInstance.createPool(
			poolScheduler,
			"A test workerpool",
			10, // lock
			10, // minimum stake
			10, // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);
		console.log("PoolInstance address *********: ", PoolInstance.address);
	});

	/***************************************************************************
	 *               TEST: Pool configuration (by poolScheduler)               *
	 ***************************************************************************/
	it("[Genesis] Pool Configuration", async () => {
		txMined = await PoolInstance.changePoolPolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *              TEST: Dapp order signature (by dappProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate dapp order", async () => {
		dapporder = odbtools.signDappOrder(
			{
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				tag:          0x0,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dappProvider)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				dappProvider,
				odbtools.DappOrderStructHash(dapporder),
				dapporder.sign
			).call(),
			"Error with the validation of the dapporder signature"
		);
	});

	/***************************************************************************
	 *              TEST: Data order signature (by dataProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate data order", async () => {
		dataorder = odbtools.signDataOrder(
			{
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				dataProvider,
				odbtools.DataOrderStructHash(dataorder),
				dataorder.sign
			).call(),
			"Error with the validation of the dataorder signature"
		);
	});

	/***************************************************************************
	 *              TEST: Pool order signature (by poolProvider)               *
	 ***************************************************************************/
	it("[Genesis] Generate pool order", async () => {
		poolorder = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       3,
				category:     4,
				trust:        1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				poolScheduler,
				odbtools.PoolOrderStructHash(poolorder),
				poolorder.sign
			).call(),
			"Error with the validation of the poolorder signature"
		);
	});

	/***************************************************************************
	 *                  TEST: User order signature (by user)                   *
	 ***************************************************************************/
	it("[Genesis] Generate user order", async () => {
		userorder = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1, // CHANGE FOR BOT
				category:     4,
				trust:        1000,
				tag:          0x0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "{\"1\":\"ace\"}",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);
		assert.isTrue(
			await IexecClerkInstanceBeta.methods.verify(
				user,
				odbtools.UserOrderStructHash(userorder),
				userorder.sign
			).call(),
			"Error with the validation of the userorder signature"
		);
	});

	it("[LOG] show order", async () => {
		// console.log("=== dapporder ===");
		// console.log(dapporder);
		// console.log("=== dataorder ===");
		// console.log(dataorder);
		// console.log("=== poolorder ===");
		// console.log(poolorder);
		// console.log("=== userorder ===");
		// console.log(userorder);
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Genesis] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolScheduler, gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker1,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker2,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker3,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: poolWorker4,   gasLimit: constants.AMOUNT_GAS_PROVIDED }),
			IexecClerkInstanceBeta.methods.deposit(1000).send({ from: user,          gasLimit: constants.AMOUNT_GAS_PROVIDED }),
		]);
		assert.isBelow(txsMined[0].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		// assert.equal(txsMined[0].events.Deposit.returnValues.owner,  poolScheduler, "check deposit recipient");
		assert.equal(txsMined[0].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
		// assert.equal(txsMined[1].events.Deposit.returnValues.owner,  poolWorker1,   "check deposit recipient");
		assert.equal(txsMined[1].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
		// assert.equal(txsMined[2].events.Deposit.returnValues.owner,  poolWorker2,   "check deposit recipient");
		assert.equal(txsMined[2].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
		// assert.equal(txsMined[3].events.Deposit.returnValues.owner,  poolWorker3,   "check deposit recipient");
		assert.equal(txsMined[3].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
		// assert.equal(txsMined[4].events.Deposit.returnValues.owner,  poolWorker4,   "check deposit recipient");
		assert.equal(txsMined[4].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
		// assert.equal(txsMined[5].events.Deposit.returnValues.owner,  user,          "check deposit recipient");
		assert.equal(txsMined[5].events.Deposit.returnValues.amount, 1000,          "check deposit amount"   );
	});

	/***************************************************************************
	 *                           TEST: Check escrow                            *
	 ***************************************************************************/
	it("[Setup] Check balances", async () => {
		IexecClerkInstanceBeta.methods.viewAccount(dataProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(dappProvider ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolScheduler).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker1  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker2  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker3  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(poolWorker4  ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
		IexecClerkInstanceBeta.methods.viewAccount(user         ).call().then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstanceBeta.methods.matchOrders(dapporder, dataorder, poolorder, userorder).send({ from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		dealid = web3.utils.soliditySha3(
			{ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder) },
			{ t: 'uint256', v: 0                                       },
		);

		assert.equal(txMined.events.SchedulerNotice.returnValues.pool,   PoolInstance.address,                    "error");
		assert.equal(txMined.events.SchedulerNotice.returnValues.dealid, dealid,                                  "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dealid,   dealid,                                  "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dappHash, odbtools.DappOrderStructHash(dapporder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.dataHash, odbtools.DataOrderStructHash(dataorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.poolHash, odbtools.PoolOrderStructHash(poolorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.userHash, odbtools.UserOrderStructHash(userorder), "error");
		assert.equal(txMined.events.OrdersMatched.returnValues.volume,   1,                                       "error");
	});


});
