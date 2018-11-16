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

var Escrow = artifacts.require("./Escrow.sol");

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

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

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var RelayInstanceEthers      = null;
	var BrokerInstanceEthers     = null;

	var categories = [];

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

		/**
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,           jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerkInstance.abi, jsonRpcProvider);
		RelayInstanceEthers      = new ethers.Contract(RelayInstance.address,      RelayInstance.abi,      jsonRpcProvider);
		BrokerInstanceEthers     = new ethers.Contract(BrokerInstance.address,     BrokerInstance.abi,     jsonRpcProvider);
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Constructor", async () => {
		// try
		// {
			newEscrow = await new Escrow(constants.NULL.ADDRESS);
			assert.equal(newEscrow.address, constants.NULL.ADDRESS);
		// 	assert.fail("user should not be able to create escrow with null erc20 address");
		// }
		// catch (error)
		// {
		// 	assert(error, "Expected an error but did not get one");
		// 	assert(error.message.includes("VM Exception while processing transaction"), "Expected an error containing 'VM Exception while processing transaction' but got '" + error.message + "' instead");
		// }
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		try
		{
			txMined = await IexecClerkInstance.withdraw(100);
			assert.fail("user should not be able to withdraw");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction"), "Expected an error containing 'VM Exception while processing transaction' but got '" + error.message + "' instead");
		}

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		try
		{
			txMined = await IexecClerkInstance.deposit(100);
			assert.fail("user should not be able to deposit");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction"), "Expected an error containing 'VM Exception while processing transaction' but got '" + error.message + "' instead");
		}

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Approve", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		txMined = await RLCInstance.transfer(user, 1000000000, { from: iexecAdmin });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		txMined = await RLCInstance.approve(IexecClerkInstance.address, 100000000, { from: user });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		try
		{
			txMined = await IexecClerkInstance.deposit(1000000000, {from: user});
			assert.fail("user should not be able to deposit");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction"), "Expected an error containing 'VM Exception while processing transaction' but got '" + error.message + "' instead");
		}

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 0, 0 ], "check balance");

		txMined = await IexecClerkInstance.deposit(50000000, {from: user});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Deposit");
		assert.equal(events[0].args.owner,  user,     "check owner" );
		assert.equal(events[0].args.amount, 50000000, "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 50000000, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 50000000, 0 ], "check balance");

		try
		{
			txMined = await IexecClerkInstance.withdraw(100000000);
			assert.fail("user should not be able to withdraw");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction"), "Expected an error containing 'VM Exception while processing transaction' but got '" + error.message + "' instead");
		}

		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 50000000, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 50000000, 0 ], "check balance");

		txMined = await IexecClerkInstance.withdraw(10000000, {from: user});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Withdraw");
		assert.equal(events[0].args.owner,  user,     "check owner" );
		assert.equal(events[0].args.amount, 10000000, "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 960000000, "wrong rlc balance");
		balance = await IexecClerkInstanceEthers.viewAccount(user); assert.deepEqual([ balance.stake.toNumber(), balance.locked.toNumber() ], [ 40000000, 0 ], "check balance");
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
