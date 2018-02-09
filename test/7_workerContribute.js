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
var Contributions  = artifacts.require("./Contributions.sol");

const BN              = require("bn");
const keccak256       = require("solidity-sha3");
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

  Contributions.ConsensusStatusEnum = {
    UNSET:       0,
    IN_PROGRESS: 1,
    REACHED:     2,
    FAILLED:     3,
    FINALIZED:   4
  };

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let amountGazProvided              = 4000000;
  let subscriptionLockStakePolicy    = 10;
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
        console.log("transferOwnership of TaskRequestHub to IexecHub");


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
        return aIexecHubInstance.createWorkerPool(
          "myWorkerPool",
          subscriptionLockStakePolicy,
          subscriptionMinimumStakePolicy,
          subscriptionMinimumScorePolicy,
          false,
          {
            from: scheduleProvider
          });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 1);
      })
      .then(result => {
        workerPoolAddress = result;
        return AuthorizedList.new(0, {
          from: scheduleProvider
        });
      })
      .then(instance => {
        aWorkersAuthorizedListInstance = instance;
        return WorkerPool.at(workerPoolAddress);
      })
      .then(instance => {
        aWorkerPoolInstance = instance;
        return aWorkerPoolInstance.attachWorkerPoolsAuthorizedListContract(aWorkersAuthorizedListInstance.address, {
          from: scheduleProvider
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
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
        return aIexecHubInstance.subscribeToPool(workerPoolAddress, {
          from: resourceProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.createAppOrDataset("hello-world-docker", 0, "docker", "hello-world", true, {
          from: appProvider
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aAppHubInstance.getApp(appProvider, 1);
      })
      .then(result => {
        appAddress = result;
        return App.at(appAddress);
      })
      .then(instance => {
        aAppInstance = instance;
        return AuthorizedList.new(1, { //black list strategy
          from: appProvider
        });
      })
      .then(instance => {
        aWorkerPoolsAuthorizedListInstance = instance;
        return aAppInstance.attachWorkerPoolsAuthorizedListContract(aWorkerPoolsAuthorizedListInstance.address, {
          from: appProvider
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return AuthorizedList.new(1, { //black list strategy
          from: appProvider
        });
      })
      .then(instance => {
        aRequestersAuthorizedListInstance = instance;
        return aAppInstance.attachRequestersAuthorizedListContract(aRequestersAuthorizedListInstance.address, {
          from: appProvider
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.createTaskRequest(aWorkerPoolInstance.address, aAppInstance.address, 0, "noTaskParam", 100, 1, false, iExecCloudUser, {
          from: iExecCloudUser
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aTaskRequestHubInstance.getTaskRequest(iExecCloudUser, 1);
      })
      .then(result => {
        taskID = result;
        console.log("taskID is :" + taskID);
        return TaskRequest.at(taskID);
      })
      .then(instance => {
        aTaskRequestInstance = instance;
        return aIexecHubInstance.acceptTask(taskID, {
          from: scheduleProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aIexecHubInstance.TaskAccepted({}));
      })
      .then(events => Contributions.at(events[0].args.workContributions))
      .then(instance => {
        aContributiuonsInstance = instance;
        return aContributiuonsInstance.m_status.call();
      })
      .then(m_statusCall => {
        assert.strictEqual(m_statusCall.toNumber(), Contributions.ConsensusStatusEnum.IN_PROGRESS, "check m_status IN_PROGRESS");
        return aContributiuonsInstance.callForContribution(resourceProvider, 0, {
          from: scheduleProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
      });
  });

  it("resourceProvider contribution", function() {
    // const resultHash = new BN.BigInteger(web3.sha3("1").replace('0x', ''), 16);
    // const workerSalt = new BN.BigInteger(web3.sha3("salt").replace('0x', ''), 16);
    return aIexecHubInstance.deposit(30, {
        from: resourceProvider,
        gas: amountGazProvided
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        const signed = Extensions.signResult("iExec the wanderer", resourceProvider);
        return aContributiuonsInstance.contribute.call(signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: amountGazProvided
        });
      })
      .then(m_workerStake => {
        assert.strictEqual(m_workerStake.toNumber(), 30, "30% of 100 (taskprice) = 30 will be lock for resourceProvider");
        return aIexecHubInstance.checkBalance.call(resourceProvider);
      })
      .then(checkBalance => {
        assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider: 30");
        assert.strictEqual(checkBalance[1].toNumber(), 10, "check stake locked of the resourceProvider: 10 from lock at workerpool subscription");
        const signed = Extensions.signResult("iExec the wanderer", resourceProvider);
        return aContributiuonsInstance.contribute(signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aContributiuonsInstance.Contribute({}));
      })
      .then(events => {
        assert.strictEqual(events[0].args.worker, resourceProvider, "check resourceProvider call ");
        return aIexecHubInstance.checkBalance.call(resourceProvider);
      })
      .then(checkBalance => {
        assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the resourceProvider");
        assert.strictEqual(checkBalance[1].toNumber(), 40, "check stake locked of the resourceProvider : 30 + 10");
      });
  });



});
