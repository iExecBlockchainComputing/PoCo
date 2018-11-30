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

	var WorkerpoolInstance1 = null;
	var WorkerpoolInstance2 = null;
	var WorkerpoolInstance3 = null;

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

	it("[configuration] distribute tokens", async () => {
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

		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: scheduler }),
			IexecClerkInstance.deposit(1000, { from: worker1   }),
			IexecClerkInstance.deposit(1000, { from: worker2   }),
			IexecClerkInstance.deposit(1000, { from: worker3   }),
			IexecClerkInstance.deposit(1000, { from: worker4   }),
			IexecClerkInstance.deposit(1000, { from: worker5   }),
			IexecClerkInstance.deposit(1000, { from: user      }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	it("[configuration] Workerpool", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A first workerpool", 10, 10, 0, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance1 = await Workerpool.at(events[0].args.workerpool);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A second workerpool", 100, 100, 0, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance2 = await Workerpool.at(events[0].args.workerpool);

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A third workerpool", 0, 0, 10, { from: scheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance3 = await Workerpool.at(events[0].args.workerpool);
	});

	it("Subscription 1", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker1), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance1.address, { from: worker1 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance1.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker1,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker1), WorkerpoolInstance1.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker1); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990,  10 ], "check balance");
	});

	it("Subscription 2", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker2), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance2.address, { from: worker2 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address,  "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance2.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker2,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker2), WorkerpoolInstance2.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker2); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 900, 100 ], "check balance");
	});

	it("Subscription 3 - failure worker conditions", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS, "affectation issue");

		try {
			await IexecHubInstance.subscribe(WorkerpoolInstance3.address, { from: worker3 });
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS, "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker3); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
	});

	it("Subscription 4 - failure registration", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS, "affectation issue");

		try {
			await IexecHubInstance.subscribe(constants.NULL.ADDRESS, { from: worker3 });
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS, "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker3); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");
	});

	it("Subscription - Unsubscription", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance1.address, { from: worker3 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance1.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker3,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker3), WorkerpoolInstance1.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker3); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance");

		txMined = await IexecHubInstance.unsubscribe({ from: worker3 }),
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerUnsubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance1.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker3,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker3), constants.NULL.ADDRESS,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker3); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance2.address, { from: worker3 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance2.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker3,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker3), WorkerpoolInstance2.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker3); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 900, 100 ], "check balance");
	});

	it("Subscription - Eviction", async () => {
		assert.equal(await IexecHubInstance.viewAffectation(worker4), constants.NULL.ADDRESS, "affectation issue");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance2.address, { from: worker4 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance2.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker4,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker4), WorkerpoolInstance2.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker4); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 900, 100 ], "check balance");

		txMined = await IexecHubInstance.evict(worker4, { from: scheduler }),
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerEviction");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance2.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker4,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker4), constants.NULL.ADDRESS,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker4); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000, 0 ], "check balance");

		txMined = await IexecHubInstance.subscribe(WorkerpoolInstance1.address, { from: worker4 });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "WorkerSubscription");
		assert.equal(events[0].args.workerpool,   WorkerpoolInstance1.address, "check workerpool"  );
		assert.equal(events[0].args.worker, worker4,           "check worker");

		assert.equal(await IexecHubInstance.viewAffectation(worker4), WorkerpoolInstance1.address,  "affectation issue");
		balance = await IexecClerkInstance.viewAccount(worker4); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 990, 10 ], "check balance");
	});

});
