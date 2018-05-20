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
      aRLCInstance.transfer(scheduleProvider, 200000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider2, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider3, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(appProvider, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappUser, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappProvider, 100000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(iExecCloudUser, 200000, {
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
    assert.strictEqual(balances[0].toNumber(), 200000, "200000 nRLC here");
    assert.strictEqual(balances[1].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[2].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[3].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[4].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[5].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[6].toNumber(), 100000, "100000 nRLC here");
    assert.strictEqual(balances[7].toNumber(), 200000, "200000 nRLC here");

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
      aRLCInstance.approve(aIexecHubInstance.address, 200000, {
        from: scheduleProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: resourceProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: resourceProvider2,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: resourceProvider3,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: appProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: dappUser,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100000, {
        from: dappProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 200000, {
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


  });

  it("claimFailedConsensus_01: after consensusTimeout requester can call claimFailedConsensus to get refund (stake unlocked)", async function() {



    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    //cannot claimFailedConsensus before timeout
    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of scheduleProvider");


    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of scheduleProvider: 30 stake lost");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of aIexecHubInstance.address jackpot to 30 locked");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");

    await Extensions.getEventsPromise(aWorkOrderInstance.WorkOrderClaimed({}), 1, constants.EVENT_WAIT_TIMEOUT);

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderClaimed({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "the aWorkerPoolInstance address check");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderClaimed({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");


  });

  it("claimFailedConsensus_02: after consensusTimeout only requester can call claimFailedConsensus", async function() {


    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);

    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("claimFailedConsensus_03: after consensusTimeout requester can't call claimFailedConsensus twice'", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    //cannot claimFailedConsensus before timeout
    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of scheduleProvider");


    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");

    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("claimFailedConsensus_04: after consensusTimeout requester can't call claimFailedConsensus on wrong workerorder id'", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    //cannot claimFailedConsensus before timeout
    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of scheduleProvider");


    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(iExecCloudUser, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("claimFailedConsensus_05: after consensusTimeout requester can't call claimFailedConsensus on completed workorder'", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");



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
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked : 100*30%=30");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider");


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

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);

    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("claimFailedConsensus_06: after consensusTimeout requester can call claimFailedConsensus on REVEALING step. Workers stake are unlocked '", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked= 100*30%=30");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the aIexecHubInstance.address");

    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the iExecCloudUser refund");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check balance : stake 30 loose");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider 30 unlocked");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake of the resourceProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstance.address jackpot from scheduler stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the aIexecHubInstance.address");

  });


  it("claimFailedConsensus_07: after consensusTimeout requester can call claimFailedConsensus. test refund of iExecCloudUser with a dapp price and a dataset price on the workorder", async function() {

  txMined = await aIexecHubInstance.deposit(100, {
    from: scheduleProvider,
    gas: constants.AMOUNT_GAS_PROVIDED
  });
  assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

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
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance : locked= 100*30%=30");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork. (30 % of 100 =30)");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork (60 - 30 = 30)");

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);

    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider. after finalizeWork.(30 initial balance)");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider: after finalizeWork.");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider. 30 stake loose ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the scheduleProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 160, "check stake of the iExecCloudUser. 100 + 25 + 35 refund");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(appProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the appProvider.workerorder claimed nothing earned");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the appProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(datasetProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the datasetProvider.workerorder claimed nothing earned");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the datasetProvider");


  });



  it("claimFailedConsensus_08: check jackpot bonus from previous claimFailedConsensus, distribute 10 % to schedulers when completed others workerorder", async function() {


    if (!isTestRPC) this.skip("This test is only for TestRPC");

    txMined = await aIexecHubInstance.deposit(100000, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100000, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100000, {
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

    //cannot claimFailedConsensus before timeout
    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100000, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70000, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30000, "check stake locked of scheduleProvider");


    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });


    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderClaimed({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "the aWorkerPoolInstance address check");

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100000, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70000, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of scheduleProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(), 30000, "check stake locked of aIexecHubInstance.address. jackpot to 30 locked");

    txMined = await aIexecHubInstance.deposit(100000, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100000, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid2;
    txMined = await aIexecHubInstance.deposit(100000, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(2, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid2 = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid2);


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid2, [resourceProvider], 0, {
      from: scheduleProvider
    });


    txMined = await aIexecHubInstance.deposit(30000, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30000, "check stake of the resourceProvider - before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider -  before contribute ");

    //resourceProvider
    signedResourceProvider = await Extensions.signResult("iExec V2 comming soon", resourceProvider);

    txMined = await aWorkerPoolInstance.contribute(woid2, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
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

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid2, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100000, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30000, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0xe9ff9ce7ec1e541c6029eca3eb77ec094dafbaf33801829806e52900ee6a8ced', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 1, "check revealCounter 1");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70000+70000, "check balance : stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30000, "check balance : locked");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork .");
    assert.strictEqual(checkBalance[1].toNumber(), 30000, "check stake locked of the resourceProvider: before finalizeWork ");

    txMined = await aWorkerPoolInstance.finalizeWork(woid2, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100000, "check stake of the iExecCloudUser pay 100");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 129000, "check stake of the resourceProvider. reward 99000 + 30000 initial");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of resourceProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstanceaddress");
    assert.strictEqual(checkBalance[1].toNumber(), 27000, "check stake locked of aIexecHubInstance.address. from 30000 - 10%30000 = 30000 - 3000 = 27000");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100000  + 70000+ 1000 + 3000, "check stake of the scheduleProvider:  170000 inital  + 1000 reward + 3000 bonus from jackpot");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of scheduleProvider");

  });


  it("claimFailedConsensus_09: check jackpot bonus from previous claimFailedConsensus < 1000, distribute all fund to schedulers when completed others workerorder", async function() {


    if (!isTestRPC) this.skip("This test is only for TestRPC");


    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


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

    //cannot claimFailedConsensus before timeout
    await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.claimFailedConsensus(woid, {
          from: iExecCloudUser,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef) + 1);


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of scheduleProvider= 100*30%=30");


    txMined = await aIexecHubInstance.claimFailedConsensus(woid, {
      from: iExecCloudUser,
    });


    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.CLAIMED, "check m_status CLAIMED");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderClaimed({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "the aWorkerPoolInstance address check");

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of scheduleProvider. lost 30");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstance.address");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of aIexecHubInstance.address. jackpot to 30 locked");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1, 0, 100, workerPoolAddress, 1, {
      from: scheduleProvider
    });

    let woid2;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(2, aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid2 = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid2);


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid2, [resourceProvider], 0, {
      from: scheduleProvider
    });


    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider - before contribute ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the resourceProvider -  before contribute ");

    //resourceProvider
    signedResourceProvider = await Extensions.signResult("iExec V2 comming soon", resourceProvider);

    txMined = await aWorkerPoolInstance.contribute(woid2, signedResourceProvider.hash, signedResourceProvider.sign, 0, 0, 0, {
      from: resourceProvider,
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

    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimeout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid2, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0xe9ff9ce7ec1e541c6029eca3eb77ec094dafbaf33801829806e52900ee6a8ced', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 1, "check revealCounter 1");
    assert.isTrue(consensusTimeout.toNumber() > 0, "check consensusTimeout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70+70, "check balance scheduleProvider: stake");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check balance scheduleProvider: locked 100*30%  ");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider: before finalizeWork .");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the resourceProvider: before finalizeWork ");

    txMined = await aWorkerPoolInstance.finalizeWork(woid2, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.COMPLETED, "check m_status COMPLETED");


    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 100, "check stake of the iExecCloudUser pay 100. refund 100");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 129, "check stake of the resourceProvider. reward 99 + 30 initial");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of resourceProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(aIexecHubInstance.address);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the aIexecHubInstanceaddress");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of aIexecHubInstance.address. jackpot clear 30 -> 0");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 70+100+ 1 + 30, "check stake of the scheduleProvider:  70 initial + 100 unlock + 1 reward + 30  all bonus from jackpot");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of scheduleProvider");

  });


});
