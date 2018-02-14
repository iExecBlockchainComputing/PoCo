var RLC            = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub       = artifacts.require("./IexecHub.sol");
var WorkerPoolHub  = artifacts.require("./WorkerPoolHub.sol");
var AppHub         = artifacts.require("./AppHub.sol");
var DatasetHub     = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");
var WorkerPool     = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");
var App            = artifacts.require("./App.sol");
var TaskRequest    = artifacts.require("./TaskRequest.sol");

const Promise         = require("bluebird");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions      = require("../utils/extensions.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

addEvmFunctions(web3);
Promise.promisifyAll(web3.eth,     { suffix: "Promise" });
Promise.promisifyAll(web3.version, { suffix: "Promise" });
Promise.promisifyAll(web3.evm,     { suffix: "Promise" });
Extensions.init(web3, assert);

contract('IexecHub', function(accounts) {

  TaskRequest.TaskRequestStatusEnum = {
    UNSET:     0,
    PENDING:   1,
    ACCEPTED:  2,
    CANCELLED: 3,
    ABORTED:   4,
    COMPLETED: 5
  };

  WorkerPool.ConsensusStatusEnum = {
    UNSET:       0,
    PENDING:     1,
    CANCELED:    2,
    STARTED:     3,
    IN_PROGRESS: 4,
    REACHED:     5,
    FAILLED:     6,
    FINALIZED:   7
  };

  let DAPP_PARAMS_EXAMPLE ="{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}";

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let amountGazProvided              = 4000000;
  let subscriptionLockStakePolicy    = 0;
  let subscriptionMinimumStakePolicy = 0;
  let subscriptionMinimumScorePolicy = 0;
  let isTestRPC;
  let testTimemout = 0;
  let aRLCInstance;
  let aIexecHubInstance;
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aTaskRequestHubInstance;

  //specific for test :
  let workerPoolAddress;
  let aWorkerPoolInstance;
  let aWorkersAuthorizedListInstance

  let appAddress;
  let aAppInstance;
  let aWorkerPoolsAuthorizedListInstance;
  let aRequestersAuthorizedListInstance;
  let aTaskRequestInstance;
  let taskID;

  let aContributiuonsInstance;


  before("should prepare accounts and check TestRPC Mode", function() {
    assert.isAtLeast(accounts.length, 8, "should have at least 8 accounts");
    scheduleProvider   = accounts[0];
    resourceProvider   = accounts[1];
    appProvider        = accounts[2];
    datasetProvider    = accounts[3];
    dappUser           = accounts[4];
    dappProvider       = accounts[5];
    iExecCloudUser     = accounts[6];
    marketplaceCreator = accounts[7];

    return Extensions.makeSureAreUnlocked(
        [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser])
      .then(() => web3.eth.getBalancePromise(scheduleProvider))
      .then(balance => assert.isTrue(
        web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
        "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether")))
      .then(() => Extensions.refillAccount(scheduleProvider, resourceProvider, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, appProvider, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, datasetProvider, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, dappUser, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, dappProvider, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, iExecCloudUser, 10))
      .then(() => Extensions.refillAccount(scheduleProvider, marketplaceCreator, 10))
      .then(() => web3.version.getNodePromise())
      .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0)
      .then(() => {
        return RLC.new({
          from: marketplaceCreator,
          gas: amountGazProvided
        });
      })
      .then(instance => {
        aRLCInstance = instance;
        console.log("aRLCInstance.address is ");
        console.log(aRLCInstance.address);
        return aRLCInstance.unlock({
          from: marketplaceCreator,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Promise.all([
          aRLCInstance.transfer(scheduleProvider, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(resourceProvider, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(appProvider, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(datasetProvider, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(dappUser, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(dappProvider, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(iExecCloudUser, 100, {
            from: marketplaceCreator,
            gas: amountGazProvided
          })
        ]);
      })
      .then(txsMined => {
        assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Promise.all([
          aRLCInstance.balanceOf(scheduleProvider),
          aRLCInstance.balanceOf(resourceProvider),
          aRLCInstance.balanceOf(appProvider),
          aRLCInstance.balanceOf(datasetProvider),
          aRLCInstance.balanceOf(dappUser),
          aRLCInstance.balanceOf(dappProvider),
          aRLCInstance.balanceOf(iExecCloudUser)
        ]);
      })
      .then(balances => {
        assert.strictEqual(balances[0].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[1].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[2].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[3].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[4].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[5].toNumber(), 100, "100 nRLC here");
        assert.strictEqual(balances[6].toNumber(), 100, "100 nRLC here");
        return WorkerPoolHub.new({
          from: marketplaceCreator
        });
      })
      .then(instance => {
        aWorkerPoolHubInstance = instance;
        console.log("aWorkerPoolHubInstance.address is ");
        console.log(aWorkerPoolHubInstance.address);
        return AppHub.new({
          from: marketplaceCreator
        });
      })
      .then(instance => {
        aAppHubInstance = instance;
        console.log("aAppHubInstance.address is ");
        console.log(aAppHubInstance.address);
        return DatasetHub.new({
          from: marketplaceCreator
        });
      })
      .then(instance => {
        aDatasetHubInstance = instance;
        console.log("aDatasetHubInstance.address is ");
        console.log(aDatasetHubInstance.address);
        return TaskRequestHub.new({
          from: marketplaceCreator
        });
      })
      .then(instance => {
        aTaskRequestHubInstance = instance;
        console.log("aTaskRequestHubInstance.address is ");
        console.log(aTaskRequestHubInstance.address);
        return IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address, {
          from: marketplaceCreator
        });
      })
      .then(instance => {
        aIexecHubInstance = instance;
        console.log("aIexecHubInstance.address is ");
        console.log(aIexecHubInstance.address);
        return aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: marketplaceCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of WorkerPoolHub to IexecHub");
        return aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: marketplaceCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of AppHub to IexecHub");
        return aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: marketplaceCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of DatasetHub to IexecHub");
        return aTaskRequestHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: marketplaceCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");


        return Promise.all([
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
      })
      .then(txsMined => {
        assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
        assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");

        console.log("transferOwnership of TaskRequestHub to IexecHub");
        return aIexecHubInstance.createWorkerPool(
          "myWorkerPool",
          subscriptionLockStakePolicy,
          subscriptionMinimumStakePolicy,
          subscriptionMinimumScorePolicy,
          {
            from: scheduleProvider
          });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 0);
      })
      .then(result => {
        workerPoolAddress = result;
        return WorkerPool.at(workerPoolAddress);
      })
      .then(instance => {
        aWorkerPoolInstance = instance;
        return aWorkerPoolInstance.m_workersAuthorizedListAddress.call();
      })
      .then( workersAuthorizedListAddress => AuthorizedList.at(workersAuthorizedListAddress))
      .then(instance => {
        aWorkersAuthorizedListInstance = instance;
        return aWorkersAuthorizedListInstance.updateWhitelist(resourceProvider, true, {
          from: scheduleProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.deposit(subscriptionLockStakePolicy, {
            from: resourceProvider,
            gas: amountGazProvided
          });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkerPoolInstance.subscribeToPool({
          from: resourceProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.createApp("R Clifford Attractors", 0, DAPP_PARAMS_EXAMPLE,{
          from: appProvider
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aAppHubInstance.getApp(appProvider, 0);
      })
      .then(result => {
        appAddress = result;
        return App.at(appAddress);
      })
      .then(instance => {
        aAppInstance = instance;
        return aIexecHubInstance.createTaskRequest(aWorkerPoolInstance.address, aAppInstance.address, 0, "noTaskParam", 0, 1, false, iExecCloudUser, {
          from: iExecCloudUser
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aTaskRequestHubInstance.getTaskRequest(iExecCloudUser, 0);
      })
      .then(result => {
        taskID = result;
        console.log("taskID is :" + taskID);
        return TaskRequest.at(taskID);
      })
      .then(instance => {
        aTaskRequestInstance = instance;
        return aWorkerPoolInstance.acceptTask(taskID, {
          from: scheduleProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkerPoolInstance.getWorkInfo.call(taskID);
      })
      .then(getWorkInfoCall => {
        [status,schedulerReward,workersReward,stakeAmount, consensus,revealDate, revealCounter, consensusTimout ] = getWorkInfoCall;
        assert.strictEqual(status.toNumber(), WorkerPool.ConsensusStatusEnum.STARTED, "check m_status STARTED");
      });;
  });


  it("scheduleProvider notify workers to work by calling the callForContribution function", function() {
    return aWorkerPoolInstance.callForContribution(taskID,resourceProvider, 0, {
      from: scheduleProvider,
      gas: amountGazProvided
    })
    .then(txMined =>{
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aWorkerPoolInstance.CallForContribution({}));
    })
    .then(events => {
      assert.strictEqual(events[0].args.taskID,taskID,"taskID check");
      assert.strictEqual(events[0].args.worker, resourceProvider, "check resourceProvider call ");
      return aWorkerPoolInstance.getWorkInfo.call(taskID);
    })
    .then(getWorkInfoCall => {
      [status,schedulerReward,workersReward,stakeAmount, consensus,revealDate, revealCounter, consensusTimout ] = getWorkInfoCall;
      assert.strictEqual(status.toNumber(), WorkerPool.ConsensusStatusEnum.IN_PROGRESS, "check m_status IN_PROGRESS");
    });
  });



});
