var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecStack         = artifacts.require("IexecStack");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { shouldFail } = require('openzeppelin-test-helpers');
const   multiaddr    = require('multiaddr');
const   constants    = require("../../../utils/constants");
const   odbtools     = require('../../../utils/odb-tools');
const   wallets      = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

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

	var RLCInstance                = null;
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
		RLCInstance                = await RLC.deployed();
		IexecHubInstance           = await IexecStack.at((await ERC1538Proxy.deployed()).address);
		IexecClerkInstance         = await IexecStack.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");


		await shouldFail.reverting(IexecClerkInstance.withdraw(100));

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		await shouldFail.reverting(IexecClerkInstance.deposit(100, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	it("Escrow - DepositFor error #1", async () => {
		assert.equal(await RLCInstance.balanceOf(scheduler), 0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		await shouldFail.reverting(IexecClerkInstance.depositFor(100, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(scheduler), 0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Approve", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 0, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		txMined = await RLCInstance.transfer(user, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		txMined = await RLCInstance.approve(IexecClerkInstance.address, 100000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		await shouldFail.reverting(IexecClerkInstance.deposit(1000000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	it("Escrow - DepositFor error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(scheduler),          0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		await shouldFail.reverting(IexecClerkInstance.depositFor(1000000000, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));

		assert.equal(await RLCInstance.balanceOf(scheduler),          0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Deposit success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 1000000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

		txMined = await IexecClerkInstance.deposit(50000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Transfer");
		assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter");
		assert.equal(events[0].args.to,    user,                   "check owner" );
		assert.equal(events[0].args.value, 50000000,               "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 950000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");
	});

	it("Escrow - DepositFor success", async () => {
		assert.equal(await RLCInstance.balanceOf(scheduler),         0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 950000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [        0, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");

		txMined = await IexecClerkInstance.depositFor(50000000, scheduler, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Transfer");
		assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter");
		assert.equal(events[0].args.to,    scheduler,              "check target");
		assert.equal(events[0].args.value, 50000000,               "check amount");

		assert.equal(await RLCInstance.balanceOf(scheduler),         0, "wrong rlc balance");
		assert.equal(await RLCInstance.balanceOf(user     ), 900000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(scheduler), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user     ), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw error #2", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");

		await shouldFail.reverting(IexecClerkInstance.withdraw(100000000));

		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");
	});

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	it("Escrow - Withdraw success", async () => {
		assert.equal(await RLCInstance.balanceOf(user), 900000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 50000000, 0 ], "check balance");

		txMined = await IexecClerkInstance.withdraw(10000000, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "Transfer");
		assert.equal(events[0].args.from,  user,                   "check owner" );
		assert.equal(events[0].args.to,    constants.NULL.ADDRESS, "check burner");
		assert.equal(events[0].args.value, 10000000,               "check amount");

		assert.equal(await RLCInstance.balanceOf(user), 910000000, "wrong rlc balance");
		assert.deepEqual(Object.extract(await IexecClerkInstance.viewAccount(user), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 40000000, 0 ], "check balance");
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
