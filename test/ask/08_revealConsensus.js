var RLC            = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub       = artifacts.require("./IexecHub.sol");
var WorkerPoolHub  = artifacts.require("./WorkerPoolHub.sol");
var AppHub         = artifacts.require("./AppHub.sol");
var DatasetHub     = artifacts.require("./DatasetHub.sol");
var WorkerPool     = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");
var App            = artifacts.require("./App.sol");
var WorkOrder      = artifacts.require("./WorkOrder.sol");
var IexecLib       = artifacts.require("./IexecLib.sol");
var Marketplace    = artifacts.require("./Marketplace.sol");

const Promise         = require("bluebird");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions      = require("../../utils/extensions.js");
const addEvmFunctions = require("../../utils/evmFunctions.js");

addEvmFunctions(web3);
Promise.promisifyAll(web3.eth,     { suffix: "Promise" });
Promise.promisifyAll(web3.version, { suffix: "Promise" });
Promise.promisifyAll(web3.evm,     { suffix: "Promise" });
Extensions.init(web3, assert);

contract('IexecHub', function(accounts) {

	WorkOrder.WorkOrderStatusEnum = {
		UNSET:     0,
		PENDING:   1,
		CANCELLED: 2,
		ACTIVE:    3,
		REVEALING: 4,
		CLAIMED:   5,
		COMPLETED: 6
	};
	IexecLib.MarketOrderDirectionEnum = {
		UNSET  : 0,
		BID    : 1,
		ASK    : 2,
		CLOSED : 3
	};

	let DAPP_PARAMS_EXAMPLE = "{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}";

	let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
	let amountGazProvided              = 4000000;
	let subscriptionLockStakePolicy    = 0;
	let subscriptionMinimumStakePolicy = 10;
	let subscriptionMinimumScorePolicy = 0;
	let isTestRPC;
	let txMined;
	let txsMined;
	let testTimemout = 0;
	let aRLCInstance;
	let aIexecHubInstance;
	let aWorkerPoolHubInstance;
	let aAppHubInstance;
	let aDatasetHubInstance;
	let aMarketplaceInstance;

	//specific for test :
	let workerPoolAddress;
	let aWorkerPoolInstance;
	let aWorkersAuthorizedListInstance

	let appAddress;
	let aAppInstance;
	let aWorkerPoolsAuthorizedListInstance;
	let aRequestersAuthorizedListInstance;
	let aWorkOrderInstance;

	before("should prepare accounts and check TestRPC Mode", async() => {
		assert.isAtLeast(accounts.length, 8, "should have at least 8 accounts");
		scheduleProvider   = accounts[0];
		resourceProvider   = accounts[1];
		appProvider        = accounts[2];
		datasetProvider    = accounts[3];
		dappUser           = accounts[4];
		dappProvider       = accounts[5];
		iExecCloudUser     = accounts[6];
		marketplaceCreator = accounts[7];

		await Extensions.makeSureAreUnlocked(
			[scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser]);
		let balance = await web3.eth.getBalancePromise(scheduleProvider);
		assert.isTrue(
			web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
			"dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
			await Extensions.refillAccount(scheduleProvider, resourceProvider,   10);
			await Extensions.refillAccount(scheduleProvider, appProvider,        10);
			await Extensions.refillAccount(scheduleProvider, datasetProvider,    10);
			await Extensions.refillAccount(scheduleProvider, dappUser,           10);
			await Extensions.refillAccount(scheduleProvider, dappProvider,       10);
			await Extensions.refillAccount(scheduleProvider, iExecCloudUser,     10);
			await Extensions.refillAccount(scheduleProvider, marketplaceCreator, 10);
		let node = await web3.version.getNodePromise();
		isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
		// INIT RLC
		aRLCInstance = await RLC.new({
			from: marketplaceCreator,
			gas: amountGazProvided
		});
		console.log("aRLCInstance.address is ");
		console.log(aRLCInstance.address);
		let txMined = await aRLCInstance.unlock({
			from: marketplaceCreator,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		txsMined = await Promise.all([
			aRLCInstance.transfer(scheduleProvider, 1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(resourceProvider, 1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(appProvider,      1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(datasetProvider,  1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(dappUser,         1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(dappProvider,     1000, { from: marketplaceCreator, gas: amountGazProvided }),
			aRLCInstance.transfer(iExecCloudUser,   1000, { from: marketplaceCreator, gas: amountGazProvided })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");
		let balances = await Promise.all([
			aRLCInstance.balanceOf(scheduleProvider),
			aRLCInstance.balanceOf(resourceProvider),
			aRLCInstance.balanceOf(appProvider),
			aRLCInstance.balanceOf(datasetProvider),
			aRLCInstance.balanceOf(dappUser),
			aRLCInstance.balanceOf(dappProvider),
			aRLCInstance.balanceOf(iExecCloudUser)
		]);
		assert.strictEqual(balances[0].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[1].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[2].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[3].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[4].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[5].toNumber(), 1000, "1000 nRLC here");
		assert.strictEqual(balances[6].toNumber(), 1000, "1000 nRLC here");

		// INIT SMART CONTRACTS BY marketplaceCreator
		aWorkerPoolHubInstance = await WorkerPoolHub.new({
			from: marketplaceCreator
		});
		console.log("aWorkerPoolHubInstance.address is ");
		console.log(aWorkerPoolHubInstance.address);

		aAppHubInstance = await AppHub.new({
			from: marketplaceCreator
		});
		console.log("aAppHubInstance.address is ");
		console.log(aAppHubInstance.address);

		aDatasetHubInstance = await DatasetHub.new({
			from: marketplaceCreator
		});
		console.log("aDatasetHubInstance.address is ");
		console.log(aDatasetHubInstance.address);

		aIexecHubInstance = await IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, {
			from: marketplaceCreator
		});
		console.log("aIexecHubInstance.address is ");
		console.log(aIexecHubInstance.address);

		txMined = await aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		console.log("transferOwnership of WorkerPoolHub to IexecHub");

		txMined = await aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		console.log("transferOwnership of AppHub to IexecHub");

		txMined = await aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		console.log("transferOwnership of DatasetHub to IexecHub");

		aMarketplaceInstance = await Marketplace.new(aIexecHubInstance.address,{
			from: marketplaceCreator
		});
		console.log("aMarketplaceInstance.address is ");
		console.log(aMarketplaceInstance.address);

		txMined = await aIexecHubInstance.attachMarketplace(aMarketplaceInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		console.log("attachMarketplace to IexecHub");

		//INIT RLC approval on IexecHub for all actors
		txsMined = await Promise.all([
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: scheduleProvider, gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: resourceProvider, gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: appProvider,      gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: datasetProvider,  gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: dappUser,         gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: dappProvider,     gas: amountGazProvided }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: iExecCloudUser,   gas: amountGazProvided })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");

		// INIT CREATE A WORKER POOL
		txMined = await aIexecHubInstance.createWorkerPool(
			"myWorkerPool",
			subscriptionLockStakePolicy,
			subscriptionMinimumStakePolicy,
			subscriptionMinimumScorePolicy, {
				from: scheduleProvider
			});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		workerPoolAddress = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 0);
		aWorkerPoolInstance = await WorkerPool.at(workerPoolAddress);

		// WHITELIST A WORKER IN A WORKER POOL
		workersAuthorizedListAddress = await aWorkerPoolInstance.m_workersAuthorizedListAddress.call();
		aWorkersAuthorizedListInstance = await AuthorizedList.at(workersAuthorizedListAddress);
		txMined = await aWorkersAuthorizedListInstance.updateWhitelist(resourceProvider, true, {
			from: scheduleProvider,
			gas: amountGazProvided
		});
		// WORKER ADD deposit to respect workerpool policy
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
			from: resourceProvider,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		// WORKER SUBSCRIBE TO POOL
		txMined = await aWorkerPoolInstance.subscribeToPool({
			from: resourceProvider,
			gas: amountGazProvided
		});
		// CREATE AN APP
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		txMined = await aIexecHubInstance.createApp("R Clifford Attractors", 0, DAPP_PARAMS_EXAMPLE, {
			from: appProvider
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		appAddress = await aAppHubInstance.getApp(appProvider, 0);
		aAppInstance = await App.at(appAddress);

		//Create ask Marker Order by scheduler
		txMined = await aMarketplaceInstance.emitMarketOrder(IexecLib.MarketOrderDirectionEnum.ASK, 1 /*_category*/, 0/*_trust*/, 99999999999/* _marketDeadline*/, 99999999999 /*_assetDeadline*/, 100/*_value*/, workerPoolAddress/*_workerpool of sheduler*/, 1/*_volume*/, {
			from: scheduleProvider
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

		//answerAskOrder
		txMined = await aIexecHubInstance.deposit(100, {
			from: iExecCloudUser,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

		txMined = await aIexecHubInstance.answerEmitWorkOrder(0/*_marketorderIdx*/,aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
			from: iExecCloudUser
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

		events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}));
		woid = events[0].args.woid;
		console.log("woid is: " + woid);
		aWorkOrderInstance = await WorkOrder.at(woid);

		//callForContribution
		txMined = await aWorkerPoolInstance.callForContribution(woid, resourceProvider, 0, {
			from: scheduleProvider,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
		m_statusCall = await aWorkOrderInstance.m_status.call();
		assert.strictEqual(m_statusCall.toNumber(), WorkOrder.WorkOrderStatusEnum.ACTIVE, "check m_status ACTIVE");

		//workerContribute
		assert.strictEqual(subscriptionMinimumStakePolicy, 10, "check stake sanity before contribution");
		assert.strictEqual(subscriptionLockStakePolicy,    0,  "check stake sanity before contribution");
		txMined = await aIexecHubInstance.deposit(30, {
			from: resourceProvider,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

		signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
		txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
			from: resourceProvider,
			gas: amountGazProvided
		});
		checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
		assert.strictEqual(checkBalance[0].toNumber(), 10, "check stake of the resourceProvider");
		assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider : 30 + 10");
	});

	it("revealConsensus", async function() {
		txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
			from: scheduleProvider,
			gas: amountGazProvided
		});
		assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

		events = await Extensions.getEventsPromise(aWorkerPoolInstance.RevealConsensus({}));
		assert.strictEqual(events[0].args.woid, woid, "woid check");
		assert.strictEqual(events[0].args.consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check revealed Consensus ");
		assert.strictEqual(events[0].args.consensus, Extensions.hashResult("iExec the wanderer"), "check revealed Consensus ");

		m_statusCall = await aWorkOrderInstance.m_status.call();
		assert.strictEqual(m_statusCall.toNumber(), WorkOrder.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");
		});

});
