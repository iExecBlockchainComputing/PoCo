var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../../../utils/constants");
const odbtools  = require('../../../utils/odb-tools');
const wallets   = require('../../../utils/wallets');

var Escrow = artifacts.require("./Escrow.sol");

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecClerk: Escrow', async (accounts) => {

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

	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;

	var categories = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		IexecHubInstance           = await IexecHub.deployed();
		IexecClerkInstance         = await IexecClerk.deployed();
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	});

	it("Escrow - Withdraw error #1", async () => {
		await expectRevert.unspecified(IexecClerkInstance.withdraw(100));
	});

	it("Escrow - fallback success", async () => {
		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await web3.eth.sendTransaction({ from:worker1, to: IexecClerkInstance.address, value: 50000000});
		// EVENT NOT PARSED CORRECTLY
		// events = extractEvents(txMined, IexecClerkInstance.address, "Deposit");
		// assert.equal(events[0].args.owner,  worker1,  "check owner" );
		// assert.equal(events[0].args.amount, 50000000, "check amount");

		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	it("Escrow - Deposit success", async () => {
		IexecClerkInstance.viewAccount(worker2).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await IexecClerkInstance.deposit({ from: worker2, value: 50000000, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  worker2,  "check owner" );
		assert.equal(events[0].args.amount, 50000000, "check amount");

		IexecClerkInstance.viewAccount(worker2).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	it("Escrow - DepositFor success", async () => {
		IexecClerkInstance.viewAccount(worker3).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 0, 0 ], "check balance"));

		txMined = await IexecClerkInstance.depositFor(worker3, { from: worker4, value: 50000000, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "DepositFor");
		assert.equal(events[0].args.owner,  worker4,  "check owner" );
		assert.equal(events[0].args.amount, 50000000, "check amount");
		assert.equal(events[0].args.target, worker3,  "check target");

		IexecClerkInstance.viewAccount(worker3).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
		IexecClerkInstance.viewAccount(worker4).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [        0, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #2", async () => {
		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));

		await expectRevert.unspecified(IexecClerkInstance.withdraw(100000000, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED }));

		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw success", async () => {
		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 50000000, 0 ], "check balance"));

		txMined = await IexecClerkInstance.withdraw(10000000, { from: worker1, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Withdraw");
		assert.equal(events[0].args.owner,  worker1,  "check owner" );
		assert.equal(events[0].args.amount, 10000000, "check amount");

		IexecClerkInstance.viewAccount(worker1).then(balance => assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 40000000, 0 ], "check balance"));
	});

});
