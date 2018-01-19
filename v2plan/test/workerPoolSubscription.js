var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");

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
        console.log("transferOwnership of TaskRequestHub to IexecHub")
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
        return AuthorizedList.new(0,{ //0 = whiteListPolicy
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
      });
  });
  it("TestRPC mode example : test only launch when testrpc is used", function() {
    if (!isTestRPC) this.skip("This test is only for TestRPC");
  });

  it("a white listed  worker can Subscribe", function() {
    return aWorkersAuthorizedListInstance.updateWhitelist(worker, true, {
        from: scheduler,
        gas: amountGazProvided
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
      });
  });

  it("worker not white listed cannot Subscribe", function() {
    return Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.subscribeToPool(workerPoolAddress, {
          from: worker,
          gas: amountGazProvided
        });
      },
      amountGazProvided);
  });


});
