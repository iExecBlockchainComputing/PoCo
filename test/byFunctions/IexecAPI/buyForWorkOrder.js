var RLC            = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub       = artifacts.require("./IexecHub.sol");
var WorkerPoolHub  = artifacts.require("./WorkerPoolHub.sol");
var AppHub         = artifacts.require("./AppHub.sol");
var DatasetHub     = artifacts.require("./DatasetHub.sol");
var WorkerPool     = artifacts.require("./WorkerPool.sol");
var App            = artifacts.require("./App.sol");
var WorkOrder      = artifacts.require("./WorkOrder.sol");
var IexecLib       = artifacts.require("./IexecLib.sol");
var Marketplace    = artifacts.require("./Marketplace.sol");
var IexecAPI    = artifacts.require("./IexecAPI.sol");

const Promise         = require("bluebird");
const fs              = require("fs-extra");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../../../utils/extensions.js");
const addEvmFunctions = require("../../../utils/evmFunctions.js");
const readFileAsync = Promise.promisify(fs.readFile);

addEvmFunctions(web3);
Promise.promisifyAll(web3.eth,     { suffix: "Promise" });
Promise.promisifyAll(web3.version, { suffix: "Promise" });
Promise.promisifyAll(web3.evm,     { suffix: "Promise" });
Extensions.init(web3, assert);
var constants = require("../../constants");

contract('IexecHub', function(accounts) {

	let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
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

	let appAddress;
	let aAppInstance;
	let aWorkOrderInstance;

	beforeEach("should prepare accounts and check TestRPC Mode", async() => {
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
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		console.log("aRLCInstance.address is ");
		console.log(aRLCInstance.address);
		let txMined = await aRLCInstance.unlock({
			from: marketplaceCreator,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		txsMined = await Promise.all([
			aRLCInstance.transfer(scheduleProvider, 1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(resourceProvider, 1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(appProvider,      1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(datasetProvider,  1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(dappUser,         1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(dappProvider,     1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.transfer(iExecCloudUser,   1000, { from: marketplaceCreator, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
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

		aIexecHubInstance = await IexecHub.new( {
			from: marketplaceCreator
		});
		console.log("aIexecHubInstance.address is ");
		console.log(aIexecHubInstance.address);

		txMined = await aWorkerPoolHubInstance.setImmutableOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		console.log("setImmutableOwnership of WorkerPoolHub to IexecHub");

		txMined = await aAppHubInstance.setImmutableOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		console.log("setImmutableOwnership of AppHub to IexecHub");

		txMined = await aDatasetHubInstance.setImmutableOwnership(aIexecHubInstance.address, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		console.log("setImmutableOwnership of DatasetHub to IexecHub");

		aMarketplaceInstance = await Marketplace.new(aIexecHubInstance.address,{
			from: marketplaceCreator
		});
		console.log("aMarketplaceInstance.address is ");
		console.log(aMarketplaceInstance.address);

		txMined = await aIexecHubInstance.attachContracts(aRLCInstance.address, aMarketplaceInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address,{
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		console.log("attachMarketplace to IexecHub");

		// INIT categories in MARKETPLACE
		txMined = await aIexecHubInstance.setCategoriesCreator(marketplaceCreator, {
			from: marketplaceCreator
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		console.log("setCategoriesCreator  to marketplaceCreator");
		var categoriesConfigFile = await readFileAsync("./config/categories.json");
		var categoriesConfigFileJson = JSON.parse(categoriesConfigFile);
		for(var i = 0; i < categoriesConfigFileJson.categories.length; i++) {
			console.log("created category:");
			console.log(categoriesConfigFileJson.categories[i].name);
			console.log(JSON.stringify(categoriesConfigFileJson.categories[i].description));
			console.log(categoriesConfigFileJson.categories[i].workClockTimeRef);
			txMined = await aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[i].name,JSON.stringify(categoriesConfigFileJson.categories[i].description),categoriesConfigFileJson.categories[i].workClockTimeRef, {
				from: marketplaceCreator
			});
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		}

		//INIT RLC approval on IexecHub for all actors
		txsMined = await Promise.all([
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: scheduleProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: resourceProvider, gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: appProvider,      gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: datasetProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: dappUser,         gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: dappProvider,     gas: constants.AMOUNT_GAS_PROVIDED })//,
		//	aRLCInstance.approve(aIexecHubInstance.address, 100, { from: iExecCloudUser,   gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	//	assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// INIT CREATE A WORKER POOL
		txMined = await aIexecHubInstance.createWorkerPool(
			"myWorkerPool",
			subscriptionLockStakePolicy,
			subscriptionMinimumStakePolicy,
			subscriptionMinimumScorePolicy, {
				from: scheduleProvider
			});
		workerPoolAddress = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 1);
		aWorkerPoolInstance = await WorkerPool.at(workerPoolAddress);

		// WORKER ADD deposit to respect workerpool policy
		txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
			from: resourceProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		// WORKER SUBSCRIBE TO POOL
		txMined = await aWorkerPoolInstance.subscribeToPool({
			from: resourceProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		// CREATE AN APP
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		txMined = await aIexecHubInstance.createApp("R Clifford Attractors", 0, constants.DAPP_PARAMS_EXAMPLE, {
			from: appProvider
		});
		appAddress = await aAppHubInstance.getApp(appProvider, 1);
		aAppInstance = await App.at(appAddress);

		txMined = await aIexecHubInstance.deposit(100, {
			from: scheduleProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		//Create ask Marker Order by scheduler
		txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/, 0/*_trust*/, 100/*_value*/, workerPoolAddress/*_workerpool of sheduler*/, 1/*_volume*/, {
			from: scheduleProvider
		});

	});


	it("buyForWorkOrder_01: test buyForWorkOrder from a smart contract", async function() {


    aIexecAPIInstance = await IexecAPI.new(aIexecHubInstance.address, aMarketplaceInstance.address, {
      from: iExecCloudUser
    });
    console.log("aIexecAPIInstance created "+aIexecAPIInstance.address);

    txMined = await aIexecAPIInstance.approveIexecHub(200,{
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.ApproveIexecHub({}));
    assert.strictEqual(events[0].args.iexecHub,aIexecHubInstance.address, "check iexecHub");
    assert.strictEqual(events[0].args.amount.toNumber(),200, "check amount");

    balance =await aRLCInstance.balanceOf(aIexecAPIInstance.address);
		assert.strictEqual(balance.toNumber(), 0, "check balanceOf aIexecAPIInstance.address");
		await	aRLCInstance.transfer(aIexecAPIInstance.address, 500, { from: iExecCloudUser, gas: constants.AMOUNT_GAS_PROVIDED });

    balance =await aRLCInstance.balanceOf(aIexecAPIInstance.address);
		assert.strictEqual(balance.toNumber(), 500, "check balanceOf aIexecAPIInstance.address");

    balance =await aRLCInstance.balanceOf(iExecCloudUser);
		assert.strictEqual(balance.toNumber(), 500, "check balanceOf iExecCloudUser");

    txMined = await aIexecAPIInstance.withdrawRLCFromIexecAPI(100,{
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.WithdrawRLCFromIexecAPI({}));
    assert.strictEqual(events[0].args.to,iExecCloudUser, "check to");
    assert.strictEqual(events[0].args.amount.toNumber(),100, "check amount");

    balance =await aRLCInstance.balanceOf(aIexecAPIInstance.address);
		assert.strictEqual(balance.toNumber(), 400, "check balanceOf aIexecAPIInstance.address");

    balance =await aRLCInstance.balanceOf(iExecCloudUser);
    assert.strictEqual(balance.toNumber(), 600, "check balanceOf iExecCloudUser");

		let woid;

    txMined = await aIexecAPIInstance.depositRLCOnIexecHub(200, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.DepositRLCOnIexecHub({}));
    assert.strictEqual(events[0].args.iexecHub,aIexecHubInstance.address, "check iexecHub");
    assert.strictEqual(events[0].args.amount.toNumber(),200, "check amount");

    events = await Extensions.getEventsPromise(aIexecHubInstance.Deposit({}));
		assert.strictEqual(events[0].args.owner, aIexecAPIInstance.address, "check Deposit owner");
		assert.strictEqual(events[0].args.amount.toNumber(), 200, "check Deposit amount");

    txMined = await aIexecAPIInstance.withdrawRLCFromIexecHub(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.WithdrawRLCFromIexecHub({}));
    assert.strictEqual(events[0].args.iexecHub,aIexecHubInstance.address, "check iexecHub");
    assert.strictEqual(events[0].args.amount.toNumber(),100, "check amount");

    events = await Extensions.getEventsPromise(aIexecHubInstance.Withdraw({}));
    assert.strictEqual(events[0].args.owner, aIexecAPIInstance.address, "check Withdraw owner");
    assert.strictEqual(events[0].args.amount.toNumber(), 100, "check Withdraw amount");


    balance =await aRLCInstance.balanceOf(aIexecAPIInstance.address);
		assert.strictEqual(balance.toNumber(), 200, "check balanceOf aIexecAPIInstance.address");

    balance =await aRLCInstance.balanceOf(iExecCloudUser);
    assert.strictEqual(balance.toNumber(), 700, "check balanceOf iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecAPIInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the aIexecAPIInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(),  0, "check stake locked of the aIexecAPIInstance.address");

		txMined = await aIexecAPIInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", aIexecAPIInstance.address, marketplaceCreator, {
			from: iExecCloudUser
		});
		events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}),1,constants.EVENT_WAIT_TIMEOUT);
		woid = events[0].args.woid;
		assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

		events = await Extensions.getEventsPromise(aIexecAPIInstance.WorkOrderActivated({}),1,constants.EVENT_WAIT_TIMEOUT);
		assert.strictEqual(events[0].args.woid, woid, "check woid");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecAPIInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecAPIInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(),  100, "check stake locked of the aIexecAPIInstance.address");

   aWorkOrderInstance = await WorkOrder.at(woid);
   let status = await aWorkOrderInstance.m_status.call();
   assert.strictEqual(status.toNumber(), constants.WorkOrderStatusEnum.ACTIVE, "check m_status");

   let m_marketorderIdx = await aWorkOrderInstance.m_marketorderIdx.call();
   assert.strictEqual(m_marketorderIdx.toNumber(), 1, "check m_marketorderIdx");

   let m_app = await aWorkOrderInstance.m_app.call();
   assert.strictEqual(m_app, aAppInstance.address, "check m_app");

   let m_dataset = await aWorkOrderInstance.m_dataset.call();
   assert.strictEqual(m_dataset, '0x0000000000000000000000000000000000000000', "check m_dataset");

   let m_workerpool = await aWorkOrderInstance.m_workerpool.call();
   assert.strictEqual(m_workerpool, aWorkerPoolInstance.address, "check m_workerpool");

   let m_requester = await aWorkOrderInstance.m_requester.call();
   assert.strictEqual(m_requester, aIexecAPIInstance.address, "check m_requester");

   let m_emitcost = await aWorkOrderInstance.m_emitcost.call();
   assert.strictEqual(m_emitcost.toNumber(), 0, "check m_emitcost = 0");

   let m_params = await aWorkOrderInstance.m_params.call();
   assert.strictEqual(m_params, "noParam", "check m_params");

   let m_callback = await aWorkOrderInstance.m_callback.call();
   assert.strictEqual(m_callback, aIexecAPIInstance.address, "check m_callback");

    let m_beneficiary = await aWorkOrderInstance.m_beneficiary.call();
    assert.strictEqual(m_beneficiary, marketplaceCreator, "check m_beneficiary marketplaceCreator");

    let m_iexecHubAddress = await aWorkOrderInstance.m_iexecHubAddress.call();
    assert.strictEqual(m_iexecHubAddress, aIexecHubInstance.address, "check m_iexecHubAddress");


	});

});
