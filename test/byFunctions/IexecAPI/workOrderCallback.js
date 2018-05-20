var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var App = artifacts.require("./App.sol");
var WorkOrder = artifacts.require("./WorkOrder.sol");
var IexecLib = artifacts.require("./IexecLib.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var IexecAPI = artifacts.require("./IexecAPI.sol");

const Promise = require("bluebird");
const fs = require("fs-extra");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../../../utils/extensions.js");
const addEvmFunctions = require("../../../utils/evmFunctions.js");
const readFileAsync = Promise.promisify(fs.readFile);

addEvmFunctions(web3);
Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.version, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.evm, {
  suffix: "Promise"
});
Extensions.init(web3, assert);
var constants = require("../../constants");

contract('IexecHub', function(accounts) {

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let subscriptionLockStakePolicy = 0;
  let subscriptionMinimumStakePolicy = 0;
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
    scheduleProvider = accounts[0];
    resourceProvider = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    marketplaceCreator = accounts[7];

    await Extensions.makeSureAreUnlocked(
      [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser]);
    let balance = await web3.eth.getBalancePromise(scheduleProvider);
    assert.isTrue(
      web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
      "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
    await Extensions.refillAccount(scheduleProvider, resourceProvider, 10);
    await Extensions.refillAccount(scheduleProvider, appProvider, 10);
    await Extensions.refillAccount(scheduleProvider, datasetProvider, 10);
    await Extensions.refillAccount(scheduleProvider, dappUser, 10);
    await Extensions.refillAccount(scheduleProvider, dappProvider, 10);
    await Extensions.refillAccount(scheduleProvider, iExecCloudUser, 10);
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
      aRLCInstance.transfer(scheduleProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(appProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(datasetProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappUser, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(iExecCloudUser, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      })
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

    aMarketplaceInstance = await Marketplace.new(aIexecHubInstance.address, {
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
    for (var i = 0; i < categoriesConfigFileJson.categories.length; i++) {
      console.log("created category:");
      console.log(categoriesConfigFileJson.categories[i].name);
      console.log(JSON.stringify(categoriesConfigFileJson.categories[i].description));
      console.log(categoriesConfigFileJson.categories[i].workClockTimeRef);
      txMined = await aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[i].name, JSON.stringify(categoriesConfigFileJson.categories[i].description), categoriesConfigFileJson.categories[i].workClockTimeRef, {
        from: marketplaceCreator
      });
      assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    }

    //INIT RLC approval on IexecHub for all actors
    txsMined = await Promise.all([
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: scheduleProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: appProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: datasetProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappUser,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }) //,
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
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

  });


  it("workOrderCallback_01: test workOrderCallback from a smart contract", async function() {


    aIexecAPIInstance = await IexecAPI.new(aIexecHubInstance.address, aMarketplaceInstance.address, {
      from: iExecCloudUser
    });
    console.log("aIexecAPIInstance created " + aIexecAPIInstance.address);

    txMined = await aIexecAPIInstance.approveIexecHub(200, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.ApproveIexecHub({}));
    assert.strictEqual(events[0].args.iexecHub, aIexecHubInstance.address, "check iexecHub");
    assert.strictEqual(events[0].args.amount.toNumber(), 200, "check amount");

    let woid;

		await	aRLCInstance.transfer(aIexecAPIInstance.address, 100, { from: iExecCloudUser, gas: constants.AMOUNT_GAS_PROVIDED });


    txMined = await aIexecAPIInstance.depositRLCOnIexecHub(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecAPIInstance.DepositRLCOnIexecHub({}));
    assert.strictEqual(events[0].args.iexecHub, aIexecHubInstance.address, "check iexecHub");
    assert.strictEqual(events[0].args.amount.toNumber(), 100, "check amount");

    events = await Extensions.getEventsPromise(aIexecHubInstance.Deposit({}));
    assert.strictEqual(events[0].args.owner, aIexecAPIInstance.address, "check Deposit owner");
    assert.strictEqual(events[0].args.amount.toNumber(), 100, "check Deposit amount");

    txMined = await aIexecAPIInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", aIexecAPIInstance.address, marketplaceCreator, {
      from: iExecCloudUser
    });
    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");


    aWorkOrderInstance = await WorkOrder.at(woid);
    let status = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(status.toNumber(), constants.WorkOrderStatusEnum.ACTIVE, "check m_status");

    let m_callback = await aWorkOrderInstance.m_callback.call();
    assert.strictEqual(m_callback, aIexecAPIInstance.address, "check m_callback");



    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");


    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");


    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    events = await Extensions.getEventsPromise(aWorkerPoolInstance.RevealConsensus({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check revealed Consensus ");
    assert.strictEqual(events[0].args.consensus, Extensions.hashResult("iExec the wanderer"), "check revealed Consensus ");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Reveal({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.worker, resourceProvider, "check resourceProvider");
    assert.strictEqual(events[0].args.result, '0x5def3ac0554e7a443f84985aa9629864e81d71d59e0649ddad3d618f85a1bf4b', "check revealed result by resourceProvider");
    assert.strictEqual(events[0].args.result, web3.sha3("iExec the wanderer"), "check revealed result by resourceProvider");

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.PROVED, "check constants.ContributionStatusEnum.PROVED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 1, "check revealCounter 1 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");



    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked: 100*30%=30");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork. (30 % of 100 =30)");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork (60 - 30 = 30)");


    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderCompleted({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "the aWorkerPoolInstance address check");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    aWorkOrderInstanceResult = await Promise.all([
      aWorkOrderInstance.m_stdout.call(),
      aWorkOrderInstance.m_stderr.call(),
      aWorkOrderInstance.m_uri.call()
    ]);
    assert.strictEqual(aWorkOrderInstanceResult[0], "aStdout", "check m_stdout");
    assert.strictEqual(aWorkOrderInstanceResult[1], "aStderr", "check m_stderr");
    assert.strictEqual(aWorkOrderInstanceResult[2], "anUri", "check m_uri");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 129, "check stake of the resourceProvider. after finalizeWork.(30 initial balance + 99% of 100 = 129)");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 101, "check stake of the scheduleProvider. 100 unlocked + won 1% of price");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");


    txMined = await aMarketplaceInstance.workOrderCallback(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


		events = await Extensions.getEventsPromise(aIexecAPIInstance.WorkOrderCallback({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check  woid");
		assert.strictEqual(events[0].args.stdout, "aStdout", "check m_stdout");
    assert.strictEqual(events[0].args.stderr, "aStderr", "check m_stderr");
    assert.strictEqual(events[0].args.uri, "anUri", "check m_uri");

  });

});
