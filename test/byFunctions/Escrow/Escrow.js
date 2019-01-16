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

var Escrow = artifacts.require("./Escrow.sol");

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

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

	var categories = [];

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
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Constructor", async () => {
		newEscrow = await new Escrow(constants.NULL.ADDRESS);
		assert.equal(newEscrow.address, constants.NULL.ADDRESS);
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
			IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.withdraw(100));

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.deposit(100, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	it("Escrow - DepositFor error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.depositFor(100, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(scheduler), 0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(scheduler).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(user     ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Approve", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await RLCInstance.transfer(user, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await RLCInstance.approve(IexecClerkInstance.address, 100000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.deposit(1000000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	it("Escrow - DepositFor error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.depositFor(1000000000, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(scheduler),          0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(scheduler).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(user     ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await IexecClerkInstance.deposit(50000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  user,     "check owner" );
		assert.equal(events[0].args.amount, 50000000, "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	it("Escrow - DepositFor success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));

		txMined = await IexecClerkInstance.depositFor(50000000, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "DepositFor");
		assert.equal(events[0].args.owner,  user,      "check owner" );
		assert.equal(events[0].args.amount, 50000000,  "check amount");
		assert.equal(events[0].args.target, scheduler, "check target");

		assert.equal(await RLCInstance.balanceOf(scheduler),         0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 900000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(scheduler).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(user     ).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));

		odbtools.reverts(() => IexecClerkInstance.withdraw(100000000));

		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));

		txMined = await IexecClerkInstance.withdraw(10000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Withdraw");
		assert.equal(events[0].args.owner,  user,     "check owner" );
		assert.equal(events[0].args.amount, 10000000, "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 910000000, "wrong rlc balance");
		IexecClerkInstance.viewAccount(user).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 40000000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Check internal functions", async function() {
		assert.strictEqual(IexecClerkInstance.contract.reward, undefined, "expected reward internal");
		assert.strictEqual(IexecClerkInstance.contract.seize,  undefined, "expected seize internal" );
		assert.strictEqual(IexecClerkInstance.contract.lock,   undefined, "expected lock internal"  );
		assert.strictEqual(IexecClerkInstance.contract.unlock, undefined, "expected unlock internal");
	});

});
