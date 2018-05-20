var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var App = artifacts.require("./App.sol");
var WorkOrder = artifacts.require("./WorkOrder.sol");
var Dataset = artifacts.require("./Dataset.sol");

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

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator, resourceProvider2, resourceProvider3;
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

  beforeEach("should prepare accounts and check TestRPC Mode", async() => {
    assert.isAtLeast(accounts.length, 9, "should have at least 9 accounts");
    scheduleProvider = accounts[0];
    resourceProvider = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    marketplaceCreator = accounts[7];
    resourceProvider2 = accounts[8];
    resourceProvider3 = accounts[9];
    await Extensions.makeSureAreUnlocked(
      [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, resourceProvider2, resourceProvider3]);
    let balance = await web3.eth.getBalancePromise(scheduleProvider);
    assert.isTrue(
      web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
      "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
    await Extensions.refillAccount(scheduleProvider, resourceProvider, 10);
    await Extensions.refillAccount(scheduleProvider, resourceProvider2, 10);
    await Extensions.refillAccount(scheduleProvider, resourceProvider3, 10);
    await Extensions.refillAccount(scheduleProvider, appProvider, 10);
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
      aRLCInstance.transfer(resourceProvider2, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider3, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(appProvider, 1000, {
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
    assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    let balances = await Promise.all([
      aRLCInstance.balanceOf(scheduleProvider),
      aRLCInstance.balanceOf(resourceProvider),
      aRLCInstance.balanceOf(resourceProvider2),
      aRLCInstance.balanceOf(resourceProvider3),
      aRLCInstance.balanceOf(appProvider),
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
    assert.strictEqual(balances[7].toNumber(), 1000, "1000 nRLC here");

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
        from: resourceProvider2,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider3,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: appProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappUser,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 200, {
        from: iExecCloudUser,
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
    assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.createWorkerPool(
      "myWorkerPool",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy, {
        from: scheduleProvider
      });
    workerPoolAddress = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 1);
    aWorkerPoolInstance = await WorkerPool.at(workerPoolAddress);

    // CREATE AN APP
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

  it("finalizeWork_01: a worker and a scheduler are rewarded when finalizeWork is call successfuly", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


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
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork. (30 % of 100 =30)");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork (60 - 30 = 30)");


    //TODO check aStdout sha ?

    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.FinalizeWork({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.stdout, "aStdout", "check stdout");
    assert.strictEqual(events[0].args.stderr, "aStderr", "check stderr");
    assert.strictEqual(events[0].args.uri, "anUri", "check uri");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderCompleted({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "the aWorkerPoolInstance address check");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    await Extensions.getEventsPromise(aWorkOrderInstance.WorkOrderCompleted({}), 1, constants.EVENT_WAIT_TIMEOUT);

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


  });



  it("finalizeWork_02: 2 workers(resourceProvider and resourceProvider2) and a scheduler are rewarded when finalizeWork is call successfuly", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");


    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");



    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
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

    //check resourceProvider
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

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.PROVED, "check constants.ContributionStatusEnum.PROVED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    //check resourceProvider2
    const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Reveal({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.worker, resourceProvider2, "check resourceProvider2");
    assert.strictEqual(events[0].args.result, '0x5def3ac0554e7a443f84985aa9629864e81d71d59e0649ddad3d618f85a1bf4b', "check revealed result by resourceProvider2");
    assert.strictEqual(events[0].args.result, web3.sha3("iExec the wanderer"), "check revealed result by resourceProvider2");



    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.PROVED, "check constants.ContributionStatusEnum.PROVED");
    assert.strictEqual(resultHash, signedResourceProvider2.hash, "check resultHash");
    assert.strictEqual(resultSign, signedResourceProvider2.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 2, "check revealCounter 2 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 2, "check 2 winnerCount");



    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork :30 % of 100");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 100");


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
    assert.strictEqual(checkBalance[0].toNumber(), 79, "check stake of the resourceProvider. after finalizeWork.(30 initial + 99% of 100/2 = 30 +49,5  = 79. 0.5 remaining) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 79, "check stake of the resourceProvider2. after finalizeWork.(30 initial + 99% of 100/2 = 30 +49,5  = 79. 0.5 remaining");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 1 + 0.5 + 0.5, "check stake of the scheduleProvider. 100 unlocked initial + won 1% of price+ 0.5 remaining from resourceProvider +0,5 remaining from resourceProvider2");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");


  });


  it("finalizeWork_03: 3 workers(resourceProvider, resourceProvider2,resourceProvider3) and a scheduler are rewarded when finalizeWork is call successfuly", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 50, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(50, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider3);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 - test start");

    //resourceProvider
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider3 = await Extensions.signResult("iExec the wanderer", resourceProvider3);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider2
    const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    const result3 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result3, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 50, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 15, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 3, "check revealCounter 3 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 3, "check 3 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 85, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check balance : locked: 50 * 30% = 15");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider: before finalizeWork :30 % of 100");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 100");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 100");



    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 31, "check stake of the resourceProvider. after finalizeWork.(15 initial + 99% of 50/3 = 15 +16,6  = 31. 0.6 remaining) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 31, "check stake of the resourceProvider2. after finalizeWork.(15 initial + 99% of 50/3 = 15 +16,6  = 31. 0.6 remaining");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 31, "check stake of the resourceProvider3. after finalizeWork.(15 initial + 99% of 50/3 = 15 +16,6  = 31. 0.6 remaining");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //50 - (16+16+16 ) = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 2, "check stake of the scheduleProvider. 100 unlocked initial + 2");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

  });

  it("finalizeWork_04: 3 workers(resourceProvider, resourceProvider2,resourceProvider3) and a scheduler.  4 nRLC limit case ", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 4, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(50, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider3);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 - test start");

    //resourceProvider
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider3 = await Extensions.signResult("iExec the wanderer", resourceProvider3);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider2
    const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    const result3 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result3, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 4, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 1, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 3, "check revealCounter 3 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 3, "check 3 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 99, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 1, "check balance : locked: 4*30% = 1.2 = 1");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 14, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 1, "check stake locked of the resourceProvider: before finalizeWork :30 % of 4=1");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 14, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 1, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 4=1");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 14, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 1, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 4=1");



    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 16, "check stake of the resourceProvider. after finalizeWork.(15 initial. nothing reward 2 nRLC are not splitable ...) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 16, "check stake of the resourceProvider2. after finalizeWork.(15 initial.nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 16, "check stake of the resourceProvider3. after finalizeWork.(15 initial .nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //4- (1 reward worker 1 +1 reward worker 1+1 reward worker 1 ) = 4
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 1, "check stake of the scheduleProvider. 100 unlocked initial + 1");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

  });



  it("finalizeWork_05: 3 workers(resourceProvider, resourceProvider2,resourceProvider3) and a scheduler. 2 nRLC can't be divided in 3 ...no reward to worker. Only scheduler has reward.", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 2, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(50, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider3);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 - test start");

    //resourceProvider
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider3 = await Extensions.signResult("iExec the wanderer", resourceProvider3);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider2
    const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    const result3 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result3, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 2, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 0, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 3, "check revealCounter 3 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 3, "check 3 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check balance : locked. 2 * 30% = 0.6 = 0");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: before finalizeWork :30 % of 2=0");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 2=0");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: before finalizeWork 30 % of 2=0");



    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider. after finalizeWork.(15 initial. nothing reward 2 nRLC are not splitable ...) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2. after finalizeWork.(15 initial.nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3. after finalizeWork.(15 initial .nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //2- (0 reward worker 1 +0 reward worker 1+0 reward worker 1 ) = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 2, "check stake of the scheduleProvider. 100 unlocked initial + 2");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

  });

  it("finalizeWork_06: 3 workers(resourceProvider, resourceProvider2,resourceProvider3) and a scheduler. free workorder is possible. no reward.", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 0, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(50, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider3);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 - test start");

    //resourceProvider
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider3 = await Extensions.signResult("iExec the wanderer", resourceProvider3);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider2
    const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    const result3 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result3, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 0, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 0, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 3, "check revealCounter 3 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 3, "check 3 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: before finalizeWork :30 % of 2=0");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 2=0");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: before finalizeWork 30 % of 2=0");



    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider. after finalizeWork.(15 initial. nothing reward 2 nRLC are not splitable ...) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2. after finalizeWork.(15 initial.nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3. after finalizeWork.(15 initial .nothing reward 2 nRLC are not splitable ...");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the scheduleProvider. 100 unlocked initial");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

  });


  it("finalizeWork_07: 2 workers good contribution : resourceProvider, resourceProvider2.1 worker wrong contribution :resourceProvider3 and  scheduler and 2 worker are rewarded. Then test workers score impact", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 50, workerPoolAddress, 2, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider3);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 - test start");

    //resourceProvider
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider3 = await Extensions.signResult("iExec the wanderer WRONG", resourceProvider3);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider2
    txMined = await aWorkerPoolInstance.reveal(woid, result, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reveal(woid, web3.sha3("iExec the wanderer WRONG"), {
          from: resourceProvider3,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 50, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 15, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 2, "check revealCounter 2 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 2, "check 2 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider: before finalizeWork :30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 50");



    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 47, "check stake of the resourceProvider. after finalizeWork.(15 initial + 99% of (50+15) /2 = 15 +64/2 = 15 +32 = 47) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 47, "check stake of the resourceProvider2. after finalizeWork.(15 initial + 99% of (50+15) /2 = 15 +64/2 = 15 +32 = 47) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider3. after finalizeWork. 15 of stake are lost");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //50 +15 - (32+32 ) = 1
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 85 + 1, "check stake of the scheduleProvider. 85 unlocked initial + 1");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the scheduleProvider");

    events = await Extensions.getEventsPromise(aIexecHubInstance.AccurateContribution({
      worker: resourceProvider
    }), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");
    assert.strictEqual(events[0].args.worker, resourceProvider, "check resourceProvider AccurateContribution");


    events = await Extensions.getEventsPromise(aIexecHubInstance.AccurateContribution({
      worker: resourceProvider2
    }), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");
    assert.strictEqual(events[0].args.worker, resourceProvider2, "check resourceProvider2 AccurateContribution");

    events = await Extensions.getEventsPromise(aIexecHubInstance.FaultyContribution({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");
    assert.strictEqual(events[0].args.worker, resourceProvider3, "check resourceProvider3 FaultyContribution");

    [success, failed] = await aIexecHubInstance.m_contributionHistory.call();
    assert.strictEqual(success.toNumber(), 2, "2 AccurateContribution");
    assert.strictEqual(failed.toNumber(), 1, "1 FaultyContribution");

    [workerPool, workerScore] = await aIexecHubInstance.getWorkerStatus.call(resourceProvider);
    assert.strictEqual(workerPool, workerPoolAddress, "check workerPool");
    assert.strictEqual(workerScore.toNumber(), 1, " workerScore resourceProvider ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider);
    assert.strictEqual(getWorkerScore.toNumber(), 1, " workerScore resourceProvider ");

    [workerPool, workerScore] = await aIexecHubInstance.getWorkerStatus.call(resourceProvider2);
    assert.strictEqual(workerPool, workerPoolAddress, "check workerPool");
    assert.strictEqual(workerScore.toNumber(), 1, " workerScore resourceProvider2 ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider2);
    assert.strictEqual(getWorkerScore.toNumber(), 1, " workerScore resourceProvider2 ");

    [workerPool, workerScore] = await aIexecHubInstance.getWorkerStatus.call(resourceProvider3);
    assert.strictEqual(workerPool, workerPoolAddress, "check workerPool");
    assert.strictEqual(workerScore.toNumber(), 0, " workerScore resourceProvider3 ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider3);
    assert.strictEqual(getWorkerScore.toNumber(), 0, " workerScore resourceProvider3 ");

    //check new score of workers on next WorkOrder

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(1);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 1, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 50, "check value");
    assert.strictEqual(volume.toNumber(), 2, "check volume");
    assert.strictEqual(remaining.toNumber(), 1, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");


    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid2 = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid2);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid2, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 47, "check stake of the resourceProvider - before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider -  before contribute ");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 47, "check stake of the resourceProvider2 -  before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 -  before contribute ");

    txMined = await aIexecHubInstance.deposit(15, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 15, "check stake of the resourceProvider3 -  before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 -  before contribute ");


    //resourceProvider

    signedResourceProvider = await Extensions.signResult("iExec V2 comming soon", resourceProvider);

    txMined = await aWorkerPoolInstance.contribute(woid2, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2

    signedResourceProvider2 = await Extensions.signResult("iExec V2 comming soon", resourceProvider2);

    txMined = await aWorkerPoolInstance.contribute(woid2, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    signedResourceProvider3 = await Extensions.signResult("iExec V2 comming soon", resourceProvider3);

    txMined = await aWorkerPoolInstance.contribute(woid2, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid2, Extensions.hashResult("iExec V2 comming soon"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result2 = web3.sha3("iExec V2 comming soon");
    txMined = await aWorkerPoolInstance.reveal(woid2, result2, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider2
    txMined = await aWorkerPoolInstance.reveal(woid2, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider3
    txMined = await aWorkerPoolInstance.reveal(woid2, result2, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid2, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 50, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 15, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0xe9ff9ce7ec1e541c6029eca3eb77ec094dafbaf33801829806e52900ee6a8ced', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 3, "check revealCounter 3 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 3, "check 3 winnerCount");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 86, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check balance : locked: 50*30% = 15");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 32, "check stake of the resourceProvider: before finalizeWork second.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider: before finalizeWork second :30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 32, "check stake of the resourceProvider2: before finalizeWork second.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork second 30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork second.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork second 30 % of 50");


    txMined = await aWorkerPoolInstance.finalizeWork(woid2, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 63, "check stake of the resourceProvider. after finalizeWork.(47 initial + 99% of (50/3) = 47+16 = 63) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 63, "check stake of the resourceProvider2. after finalizeWork.(47 initial + 99% of (50/3) = 47+16 = 63)");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 31, "check stake of the resourceProvider3. after finalizeWork.initial 15 + 16 = 31");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //50  - (16*3) = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 101 + 2, "check stake of the scheduleProvider. 50 unlocked initial + 1");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider);
    assert.strictEqual(getWorkerScore.toNumber(), 2, " workerScore resourceProvider ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider2);
    assert.strictEqual(getWorkerScore.toNumber(), 2, " workerScore resourceProvider2 ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider3);
    assert.strictEqual(getWorkerScore.toNumber(), 1, " workerScore resourceProvider3 ");


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 50, workerPoolAddress, 2, {
      from: scheduleProvider
    });

    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.buyForWorkOrder(2, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid3 = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid3);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid3, [resourceProvider, resourceProvider2, resourceProvider3], 0, {
      from: scheduleProvider
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 63, "check stake of the resourceProvider - before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider -  before contribute ");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 63, "check stake of the resourceProvider2 -  before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 -  before contribute ");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 31, "check stake of the resourceProvider3 -  before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 -  before contribute ");


    //resourceProvider

    signedResourceProvider = await Extensions.signResult("iExec test score slash", resourceProvider);

    txMined = await aWorkerPoolInstance.contribute(woid3, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //resourceProvider2

    signedResourceProvider2 = await Extensions.signResult("iExec test score slash. I will be score slash to 0", resourceProvider2);

    txMined = await aWorkerPoolInstance.contribute(woid3, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //resourceProvider3
    signedResourceProvider3 = await Extensions.signResult("iExec test score slash", resourceProvider3);

    txMined = await aWorkerPoolInstance.contribute(woid3, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid3, Extensions.hashResult("iExec test score slash"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    //check resourceProvider
    const result3 = web3.sha3("iExec test score slash");
    txMined = await aWorkerPoolInstance.reveal(woid3, result3, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider2
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reveal(woid3, result3, {
          from: resourceProvider2,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    //check resourceProvider3
    txMined = await aWorkerPoolInstance.reveal(woid3, result3, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid3, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 50, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 15, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0xd936090513ab7d3efd2c7a3042bb42fc6ef29c6449a919fb743e3c1350e6f86f', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 2, "check revealCounter 2 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 2, "check 2 winnerCount");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70+3, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked: 2* 50*30%");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 48, "check stake of the resourceProvider: before finalizeWork third.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider: before finalizeWork third :30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 48, "check stake of the resourceProvider2: before finalizeWork third.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider2: before finalizeWork third 30 % of 50");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 16, "check stake of the resourceProvider3: before finalizeWork third.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider3: before finalizeWork third 30 % of 50");


    txMined = await aWorkerPoolInstance.finalizeWork(woid3, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 105, "check stake of the resourceProvider. after finalizeWork.(63 initial + 99% of (50+15/2) = 63+42 = 105) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 48, "check stake of the resourceProvider2. after finalizeWork.(63 - 15 stake = 48)");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 52, "check stake of the resourceProvider3. after finalizeWork.initial : 31 + 99% of (50+15/2) = 31 + 21 = 52 ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //50 +15  - (42 + 21 ) = 65 - 63 = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 88 + 2, "check stake of the scheduleProvider. 88 unlocked initial + 2");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the scheduleProvider");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider);
    assert.strictEqual(getWorkerScore.toNumber(), 3, " workerScore resourceProvider ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider2);
    assert.strictEqual(getWorkerScore.toNumber(), 0, " workerScore resourceProvider2 score is slashed");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider3);
    assert.strictEqual(getWorkerScore.toNumber(), 2, " workerScore resourceProvider3 ");

    //test on score > 50 done with temporory change here : m_scores[_worker] = m_scores[_worker].add(1->30);
    //after slash the score is 10 (60 - 50 =10) because of 			m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min(50));


    //test score impact  workerScore resourceProvider = 3 vs resourceProvider3  = 1

    txMined = await aIexecHubInstance.buyForWorkOrder(2, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid4 = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid4);

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid4, [resourceProvider, resourceProvider3], 0, {
      from: scheduleProvider
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 105, "check stake of the resourceProvider - before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider -  before contribute ");

    // deposit for same balance between resourceProvider and resourceProvider3
    txMined = await aIexecHubInstance.deposit(53, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 105, "check stake of the resourceProvider3 -  before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3 -  before contribute ");

    signedResourceProvider = await Extensions.signResult("compare score impact on reward", resourceProvider);

    txMined = await aWorkerPoolInstance.contribute(woid4, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    signedResourceProvider3 = await Extensions.signResult("compare score impact on reward", resourceProvider3);

    txMined = await aWorkerPoolInstance.contribute(woid4, signedResourceProvider3.hash, signedResourceProvider3.sign, 0, 0, 0, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    txMined = await aWorkerPoolInstance.revealConsensus(woid4, Extensions.hashResult("compare score impact on reward"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");

    const result4 = web3.sha3("compare score impact on reward");
    txMined = await aWorkerPoolInstance.reveal(woid4, result4, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    txMined = await aWorkerPoolInstance.reveal(woid4, result4, {
      from: resourceProvider3,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid3, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 50, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 15, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0xd936090513ab7d3efd2c7a3042bb42fc6ef29c6449a919fb743e3c1350e6f86f', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 2, "check revealCounter 2 now");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 2, "check 2 winnerCount");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 90, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check balance : locked: 50*30% = 15");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 90, "check stake of the resourceProvider: before finalizeWork third.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider: before finalizeWork third :30 % of 50");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 90, "check stake of the resourceProvider3: before finalizeWork third.");
    assert.strictEqual(checkBalance[1].toNumber(), 15, "check stake locked of the resourceProvider3: before finalizeWork third 30 % of 50");

    txMined = await aWorkerPoolInstance.finalizeWork(woid4, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);

    //workerWeight resourceProvider = 1 + log2(3)=1.5849 =  2.5849 why round to 3 ? (see after)
    //workerWeight resourceProvider3 = 1 + log2(2)=1 = 2  OK
    //totalWeight = 5

    //workersReward = 99% of 50 = 49

    //workersReward.mulByFraction(m_contributions[_woid][w].weight, totalWeight);
    //49 * (3/5) = 29.4  = 29
    //49 * (2/5) = 19.6  = 19
    assert.strictEqual(checkBalance[0].toNumber(), 134, "check stake of the resourceProvider. after finalizeWork. initial 105 + 29 ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider3);
    assert.strictEqual(checkBalance[0].toNumber(), 124, "check stake of the resourceProvider3. after finalizeWork.initial 105 + 19");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider3: after finalizeWork.");

    //  50 - (29 resourceProvider + 19 resourceProvider3 ) = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 105 + 2, "check stake of the scheduleProvider. initial 105 +2");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider);
    assert.strictEqual(getWorkerScore.toNumber(), 4, " workerScore resourceProvider ");

    getWorkerScore = await aIexecHubInstance.getWorkerScore.call(resourceProvider3);
    assert.strictEqual(getWorkerScore.toNumber(), 3, " workerScore resourceProvider3");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid4, resourceProvider);
    assert.strictEqual(weight.toNumber(), 3, "3 weight for resourceProvider");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid4, resourceProvider3);
    assert.strictEqual(weight.toNumber(), 2, "2 weight for resourceProvider3");




  });




  it("finalizeWork_08: can't finalizeWork  after consensusTimeout", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


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
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork. (30 % of 100 =30)");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork (60 - 30 = 30)");

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef)+1);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("finalizeWork_09: can't finalizeWork  after revealDate if no worker have reveal", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


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

    /*
     No worker reveal
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
    */
    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0 ");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 0 winnerCount");



    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork. (30 % of 100 =30)");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork (60 - 30 = 30)");

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("finalizeWork_10: if at least one worker reveal, scheduler can call finalizeWork after the reveal timeout ", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the scheduleProvider");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider, resourceProvider2], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider - test start");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2 - test start");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 - test start");


    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signedResourceProvider = await Extensions.signResult("iExec the wanderer", resourceProvider);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");



    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signedResourceProvider2 = await Extensions.signResult("iExec the wanderer", resourceProvider2);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider2: before contribute");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2 : before contribute");

    txMined = await aWorkerPoolInstance.contribute(woid, signedResourceProvider2.hash, signedResourceProvider2.sign, 0, 0, 0, {
      from: resourceProvider2,
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

    //check resourceProvider
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

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.PROVED, "check constants.ContributionStatusEnum.PROVED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    //check resourceProvider2 NO REVEAL.

    /*const result2 = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(woid, result2, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Reveal({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.worker, resourceProvider2, "check resourceProvider2");
    assert.strictEqual(events[0].args.result, '0x5def3ac0554e7a443f84985aa9629864e81d71d59e0649ddad3d618f85a1bf4b', "check revealed result by resourceProvider2");
    assert.strictEqual(events[0].args.result, web3.sha3("iExec the wanderer"), "check revealed result by resourceProvider2");



    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.PROVED, "check constants.ContributionStatusEnum.PROVED");
    assert.strictEqual(resultHash, signedResourceProvider2.hash, "check resultHash");
    assert.strictEqual(resultSign, signedResourceProvider2.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");
*/
    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 1, "check revealCounter 1 only ");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 2, "check 2 winnerCount");


    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork :30 % of 100");


    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2: before finalizeWork.");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider2: before finalizeWork 30 % of 100");

    // wait the reveal timeout
    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);


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

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 158, "check stake of the resourceProvider. after finalizeWork.(30 initial + 99% of (100 reward+30 stake) = 30 + 128 = 158 ) ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider2. after finalizeWork.(30 initial - 30 stake  = 0");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider2: after finalizeWork.");

    // (100 + 30) - 128  = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 2, "check stake of the scheduleProvider. 102");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the iExecCloudUser");


  });


  it("finalizeWork_11: test finalizeWork  with dapp with dappPrice and dataset with dataset price", async function() {
    //dapp
    txMined = await aIexecHubInstance.createApp("25 nRLC price app", 25, constants.DAPP_PARAMS_EXAMPLE, {
      from: appProvider
    });
    appAddress = await aAppHubInstance.getApp(appProvider, 2);
    aAppInstance = await App.at(appAddress);
    //dataset
    let datasetAddressFromLog;

    txMined = await aIexecHubInstance.createDataset(
      "35 nRLC dataset Name",
      35,
      "dataset Params", {
        from: datasetProvider,
      });

    let events = await Extensions.getEventsPromise(aIexecHubInstance.CreateDataset({}));
    assert.strictEqual(events[0].args.datasetOwner, datasetProvider, "datasetProvider");
    assert.strictEqual(events[0].args.datasetName, "35 nRLC dataset Name", "datasetName");
    assert.strictEqual(events[0].args.datasetPrice.toNumber(), 35, "datasetPrice");
    assert.strictEqual(events[0].args.datasetParams, "dataset Params", "datasetParams");
    datasetAddressFromLog = events[0].args.dataset;
    aDatasetInstance = await Dataset.at(datasetAddressFromLog);

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(160, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 160, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(appProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the appProvider.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the appProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(datasetProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the datasetProvider.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the datasetProvider");

    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1, aWorkerPoolInstance.address, aAppInstance.address, aDatasetInstance.address, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 160, "check stake locked of the iExecCloudUser");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


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
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked");

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

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(appProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 25, "check stake of the appProvider.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the appProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(datasetProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 35, "check stake of the datasetProvider.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the datasetProvider");

  });



});
