var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkOrderHub = artifacts.require("./WorkOrderHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");
var App = artifacts.require("./App.sol");
var WorkOrder = artifacts.require("./WorkOrder.sol");


const Promise = require("bluebird");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../utils/extensions.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

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

contract('IexecHub', function(accounts) {

  WorkOrder.WorkOrderStatusEnum = {
    UNSET: 0,
    PENDING: 1,
    ACCEPTED: 2,
    CANCELLED: 3,
    ABORTED: 4,
    COMPLETED: 5
  };

  WorkerPool.ConsensusStatusEnum = {
    UNSET: 0,
    PENDING: 1,
    CANCELLED: 2,
    STARTED: 3,
    IN_PROGRESS: 4,
    REACHED: 5,
    FAILLED: 6,
    FINALIZED: 7
  };

  let DAPP_PARAMS_EXAMPLE = "{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}";

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let amountGazProvided = 4000000;
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
  let aWorkOrderHubInstance;

  //specific for test :
  let workerPoolAddress;
  let aWorkerPoolInstance;
  let aWorkersAuthorizedListInstance

  let appAddress;
  let aAppInstance;
  let aWorkerPoolsAuthorizedListInstance;
  let aRequestersAuthorizedListInstance;
  let aWorkOrderInstance;
  let woid;

  let aContributiuonsInstance;


  before("should prepare accounts and check TestRPC Mode", async() => {
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
      aRLCInstance.transfer(scheduleProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(resourceProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(appProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(datasetProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(dappUser, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(dappProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(iExecCloudUser, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      })
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
    aWorkOrderHubInstance = await WorkOrderHub.new({
      from: marketplaceCreator
    });
    console.log("aWorkOrderHubInstance.address is ");
    console.log(aWorkOrderHubInstance.address);
    aIexecHubInstance = await IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aWorkOrderHubInstance.address, {
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
    txMined = await aWorkOrderHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    console.log("transferOwnership of WorkOrderHub to IexecHub");
    //INIT RLC approval on IexecHub for all actors
    txsMined = await Promise.all([
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: scheduleProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: appProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: datasetProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappUser,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: iExecCloudUser,
        gas: amountGazProvided
      })
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
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy, {
      from: resourceProvider,
      gas: amountGazProvided
    });
    // WORKER SUBSCRIBE TO POOL
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
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
    //CREATE A TASK REQUEST
    txMined = await aIexecHubInstance.createWorkOrder(aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, 1, false, iExecCloudUser, {
      from: iExecCloudUser
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    woid = await aWorkOrderHubInstance.getWorkOrder(iExecCloudUser, 0);
    console.log("woid is :" + woid);
    aWorkOrderInstance = await WorkOrder.at(woid);
  });

  it("scheduleProvider accept Pending workOrder", async function() {
    let contributionsAddress;
    txMined = await aWorkerPoolInstance.acceptWorkOrder(woid, {
      from: scheduleProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderAccepted({}));
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderAccepted({}));
    assert.strictEqual(events[0].args.woid, woid, "woid check");
    assert.strictEqual(events[0].args.workerPool, workerPoolAddress, "workerPool check");
    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), WorkOrder.WorkOrderStatusEnum.ACCEPTED, "check m_status ACCEPTED");
    getWorkInfoCall = await aWorkerPoolInstance.getWorkInfo.call(woid);
    [status, schedulerReward, workersReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout] = getWorkInfoCall;
    assert.strictEqual(status.toNumber(), WorkerPool.ConsensusStatusEnum.STARTED, "check m_status STARTED");
    //TODO check ratio price
  });



});
