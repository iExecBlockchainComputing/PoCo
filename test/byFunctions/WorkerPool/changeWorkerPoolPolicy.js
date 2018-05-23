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
  let subscriptionLockStakePolicy    = 2;
	let subscriptionMinimumStakePolicy = 3;
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
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: dappProvider,     gas: constants.AMOUNT_GAS_PROVIDED }),
			aRLCInstance.approve(aIexecHubInstance.address, 100, { from: iExecCloudUser,   gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

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



	});


	it("changeWorkerPoolPolicy_01: owner of WorkerPool  can call  changeWorkerPoolPolicy. check event WorkerPoolPolicyUpdate", async function() {

    let m_stakeRatioPolicy = await aWorkerPoolInstance.m_stakeRatioPolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    let m_schedulerRewardRatioPolicy = await aWorkerPoolInstance.m_schedulerRewardRatioPolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    let m_subscriptionMinimumStakePolicy = await aWorkerPoolInstance.m_subscriptionMinimumStakePolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    let m_subscriptionMinimumScorePolicy = await aWorkerPoolInstance.m_subscriptionMinimumScorePolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(m_stakeRatioPolicy.toNumber(), 30, "check default m_stakeRatioPolicy");
    assert.strictEqual(m_schedulerRewardRatioPolicy.toNumber(), 1, "check default m_schedulerRewardRatioPolicy");
    assert.strictEqual(m_subscriptionMinimumStakePolicy.toNumber(), 3, "check default m_subscriptionMinimumStakePolicy");
    assert.strictEqual(m_subscriptionMinimumScorePolicy.toNumber(), 0, "check default m_subscriptionMinimumScorePolicy");


    txMined =  await aWorkerPoolInstance.changeWorkerPoolPolicy(50/*_newStakeRatioPolicy*/,2/*_newSchedulerRewardRatioPolicy*/,4/*_newSubscriptionMinimumStakePolicy*/,5/*_newSubscriptionMinimumScorePolicy*/,{
      from: scheduleProvider,
      gas:constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    newStakeRatioPolicy = await aWorkerPoolInstance.m_stakeRatioPolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    newSchedulerRewardRatioPolicy = await aWorkerPoolInstance.m_schedulerRewardRatioPolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    newSubscriptionMinimumStakePolicy = await aWorkerPoolInstance.m_subscriptionMinimumStakePolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    newSubscriptionMinimumScorePolicy = await aWorkerPoolInstance.m_subscriptionMinimumScorePolicy.call({
      from: iExecCloudUser,
      gas:constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(newStakeRatioPolicy.toNumber(), 50, "check default newStakeRatioPolicy");
    assert.strictEqual(newSchedulerRewardRatioPolicy.toNumber(), 2, "check default newSchedulerRewardRatioPolicy");
    assert.strictEqual(newSubscriptionMinimumStakePolicy.toNumber(), 4, "check default newSubscriptionMinimumStakePolicy");
    assert.strictEqual(newSubscriptionMinimumScorePolicy.toNumber(), 5, "check default newSubscriptionMinimumScorePolicy");

   events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerPoolPolicyUpdate({}),1,constants.EVENT_WAIT_TIMEOUT);
   assert.strictEqual(events[0].args.oldStakeRatioPolicy.toNumber(), 30, "oldStakeRatioPolicy");
   assert.strictEqual(events[0].args.newStakeRatioPolicy.toNumber(), newStakeRatioPolicy.toNumber(), "newStakeRatioPolicy");
   assert.strictEqual(events[0].args.oldSchedulerRewardRatioPolicy.toNumber(), 1, "oldSchedulerRewardRatioPolicy");
   assert.strictEqual(events[0].args.newSchedulerRewardRatioPolicy.toNumber(), newSchedulerRewardRatioPolicy.toNumber(), "newSchedulerRewardRatioPolicy");
   assert.strictEqual(events[0].args.oldSubscriptionMinimumStakePolicy.toNumber(), 3, "oldSubscriptionMinimumStakePolicy");
   assert.strictEqual(events[0].args.newSubscriptionMinimumStakePolicy.toNumber(), newSubscriptionMinimumStakePolicy.toNumber(), "newSubscriptionMinimumStakePolicy");
   assert.strictEqual(events[0].args.oldSubscriptionMinimumScorePolicy.toNumber(), 0, "oldSubscriptionMinimumScorePolicy");
   assert.strictEqual(events[0].args.newSubscriptionMinimumScorePolicy.toNumber(), newSubscriptionMinimumScorePolicy.toNumber(), "newSubscriptionMinimumScorePolicy");

	});

  it("changeWorkerPoolPolicy_02: not owner of WorkerPool can't call  changeWorkerPoolPolicy.", async function() {

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.changeWorkerPoolPolicy(50/*_newStakeRatioPolicy*/,2/*_newSchedulerRewardRatioPolicy*/,4/*_newSubscriptionMinimumStakePolicy*/,5/*_newSubscriptionMinimumScorePolicy*/,{
          from: iExecCloudUser,
          gas:constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("changeWorkerPoolPolicy_03: owner of WorkerPool  can  set a newSchedulerRewardRatioPolicy  = 100% ", async function() {

    txMined =  await aWorkerPoolInstance.changeWorkerPoolPolicy(50/*_newStakeRatioPolicy*/,100/*_newSchedulerRewardRatioPolicy*/,4/*_newSubscriptionMinimumStakePolicy*/,5/*_newSubscriptionMinimumScorePolicy*/,{
      from: scheduleProvider,
      gas:constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerPoolPolicyUpdate({}),1,constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.newSchedulerRewardRatioPolicy.toNumber(), 100, "newSchedulerRewardRatioPolicy");

  });

  it("changeWorkerPoolPolicy_04: owner of WorkerPool  can't  set a newSchedulerRewardRatioPolicy  > 100% ", async function() {
    await Extensions.expectedExceptionPromise(() => {
        return  aWorkerPoolInstance.changeWorkerPoolPolicy(50/*_newStakeRatioPolicy*/,101/*_newSchedulerRewardRatioPolicy*/,4/*_newSubscriptionMinimumStakePolicy*/,5/*_newSubscriptionMinimumScorePolicy*/,{
          from: scheduleProvider,
          gas:constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });



});
