var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");
var App = artifacts.require("./App.sol");
var TaskRequest = artifacts.require("./TaskRequest.sol");
var Contributions = artifacts.require("./Contributions.sol");

const BN = require("bn");
const keccak256 = require("solidity-sha3");
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

  TaskRequest.TaskRequestStatusEnum = {
    UNSET: 0,
    PENDING: 1,
    ACCEPTED: 2,
    CANCELLED: 3,
    ABORTED: 4,
    COMPLETED: 5
  };

  Contributions.ConsensusStatusEnum = {
    UNSET: 0,
    IN_PROGRESS: 1,
    REACHED: 2,
    FAILLED: 3,
    FINALIZED: 4
  };

  let scheduler, worker, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, universalCreator;
  let amountGazProvided = 4000000;
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
    scheduler = accounts[0];
    worker = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    universalCreator = accounts[7];

    return Extensions.makeSureAreUnlocked(
        [scheduler, worker, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser])
      .then(() => web3.eth.getBalancePromise(scheduler))
      .then(balance => assert.isTrue(
        web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
        "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether")))
      .then(() => Extensions.refillAccount(scheduler, worker, 10))
      .then(() => Extensions.refillAccount(scheduler, appProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, datasetProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, dappUser, 10))
      .then(() => Extensions.refillAccount(scheduler, dappProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, iExecCloudUser, 10))
      .then(() => Extensions.refillAccount(scheduler, universalCreator, 10))
      .then(() => web3.version.getNodePromise())
      .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0)
      .then(() => {
        return RLC.new({
          from: universalCreator,
          gas: amountGazProvided
        });
      })
      .then(instance => {
        aRLCInstance = instance;
        console.log("aRLCInstance.address is ");
        console.log(aRLCInstance.address);
        return aRLCInstance.unlock({
          from: universalCreator,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Promise.all([
          aRLCInstance.transfer(scheduler, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(worker, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(appProvider, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(datasetProvider, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(dappUser, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(dappProvider, 100, {
            from: universalCreator,
            gas: amountGazProvided
          }),
          aRLCInstance.transfer(iExecCloudUser, 100, {
            from: universalCreator,
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
          aRLCInstance.balanceOf(scheduler),
          aRLCInstance.balanceOf(worker),
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
          from: universalCreator
        });
      })
      .then(instance => {
        aWorkerPoolHubInstance = instance;
        console.log("aWorkerPoolHubInstance.address is ");
        console.log(aWorkerPoolHubInstance.address);
        return AppHub.new({
          from: universalCreator
        });
      })
      .then(instance => {
        aAppHubInstance = instance;
        console.log("aAppHubInstance.address is ");
        console.log(aAppHubInstance.address);
        return DatasetHub.new({
          from: universalCreator
        });
      })
      .then(instance => {
        aDatasetHubInstance = instance;
        console.log("aDatasetHubInstance.address is ");
        console.log(aDatasetHubInstance.address);
        return TaskRequestHub.new({
          from: universalCreator
        });
      })
      .then(instance => {
        aTaskRequestHubInstance = instance;
        console.log("aTaskRequestHubInstance.address is ");
        console.log(aTaskRequestHubInstance.address);
        return IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address, {
          from: universalCreator
        });
      })
      .then(instance => {
        aIexecHubInstance = instance;
        console.log("aIexecHubInstance.address is ");
        console.log(aIexecHubInstance.address);
        return aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: universalCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of WorkerPoolHub to IexecHub");
        return aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: universalCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of AppHub to IexecHub");
        return aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: universalCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of DatasetHub to IexecHub");
        return aTaskRequestHubInstance.transferOwnership(aIexecHubInstance.address, {
          from: universalCreator
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        console.log("transferOwnership of TaskRequestHub to IexecHub");
        return Promise.all([
          aRLCInstance.approve(aIexecHubInstance.address, 100, {
            from: scheduler,
            gas: amountGazProvided
          }),
          aRLCInstance.approve(aIexecHubInstance.address, 100, {
            from: worker,
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
        return aIexecHubInstance.createWorkerPool("myWorkerPool", {
          from: scheduler
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkerPoolHubInstance.getWorkerPool(scheduler, 1);
      })
      .then(result => {
        workerPoolAddress = result;
        return AuthorizedList.new(0, {
          from: scheduler
        });
      })
      .then(instance => {
        aWorkersAuthorizedListInstance = instance;
        return WorkerPool.at(workerPoolAddress);
      })
      .then(instance => {
        aWorkerPoolInstance = instance;
        return aWorkerPoolInstance.attachWorkerPoolsAuthorizedListContract(aWorkersAuthorizedListInstance.address, {
          from: scheduler
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aWorkersAuthorizedListInstance.updateWhitelist(worker, true, {
          from: scheduler,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.subscribeToPool(workerPoolAddress, {
          from: worker,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.createApp("hello-world-docker", 0, "docker", "hello-world", {
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
        return aIexecHubInstance.createTaskRequest(aWorkerPoolInstance.address, aAppInstance.address, 0, "noTaskParam", 100, 1, false, {
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
          from: scheduler,
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
        return aContributiuonsInstance.callForContribution(worker, {
          from: scheduler,
          gas: amountGazProvided
        });
      }).then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.deposit(30, {
          from: worker,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");

        const resultHash = new BN.BigInteger(web3.sha3("1").replace('0x', ''), 16);
        const workerSalt = new BN.BigInteger(web3.sha3("salt").replace('0x', ''), 16);

        /*
        console.log(web3.sha3("1"));
        console.log(web3.sha3("salt"));
        console.log(resultHash.xor(workerSalt).toString(16));
        console.log(keccak256.sha3num("0x68c0ceeb07d48c79892b773b198e0081e235e40c916949068700dbbd8e48f0b6"));
        console.log(keccak256.sha3num("0x"+resultHash.xor(workerSalt).toString(16)));
        result:
        0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6
        0xa05e334153147e75f3f416139b5109d1179cb56fef6a4ecb4c4cbc92a7c37b70
        68c0ceeb07d48c79892b773b198e0081e235e40c916949068700dbbd8e48f0b6
        0x570ac63f587493f3ec6a35fb0ff6863a1244914e734c6d013bd73b7afd1e70f3
        0x570ac63f587493f3ec6a35fb0ff6863a1244914e734c6d013bd73b7afd1e70f3
        */
        //keccak256(_resultHash         ) => vote
        //keccak256(_resultHash ^ _salt ) => proof of knowledge
        return aContributiuonsInstance.contribute(keccak256.sha3num(web3.sha3("1")), keccak256.sha3num("0x" + resultHash.xor(workerSalt).toString(16)), {
          from: worker,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aIexecHubInstance.checkBalance.call(worker);
      })
      .then(checkBalance => {
        assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the worker");
        assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake locked of the worker");
        return aContributiuonsInstance.revealConsensus(keccak256.sha3num(web3.sha3("1")), {
          from: scheduler,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aContributiuonsInstance.reveal(web3.sha3("1"), web3.sha3("salt"), {
          from: worker,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
      });
  });

  it("scheduler call finalizedTask", function() {
    return aContributiuonsInstance.finalizedTask("aStdout", "aStderr", "anUri", {
        from: scheduler,
        gas: amountGazProvided
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return aContributiuonsInstance.m_status.call();
      })
      .then(m_statusCall => {
        assert.strictEqual(m_statusCall.toNumber(), Contributions.ConsensusStatusEnum.FINALIZED, "check m_status FINALIZED");
        return Extensions.getEventsPromise(aIexecHubInstance.TaskCompleted({}));
      })
      .then(events => {
        assert.strictEqual(events[0].args.taskID, taskID, "taskID check");
        assert.strictEqual(events[0].args.workContributions, aContributiuonsInstance.address, "the ContributiuonsInstance address check");
        return aTaskRequestInstance.m_status.call();
      })
      .then(m_statusCall => {
        assert.strictEqual(m_statusCall.toNumber(), TaskRequest.TaskRequestStatusEnum.COMPLETED, "check m_status COMPLETED");
        return Promise.all([
          aTaskRequestInstance.m_stdout.call(),
          aTaskRequestInstance.m_stderr.call(),
          aTaskRequestInstance.m_uri.call()
        ]);
      })
      .then(result => {
        assert.strictEqual(result[0], "aStdout", "check m_stdout");
        assert.strictEqual(result[1], "aStderr", "check m_stderr");
        assert.strictEqual(result[2], "anUri", "check m_uri");
        return aIexecHubInstance.checkBalance.call(worker);
      })
      .then(checkBalance => {
        assert.strictEqual(checkBalance[0].toNumber(), 130, "check stake of the worker");
        assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the worker");
      });
  });


});
