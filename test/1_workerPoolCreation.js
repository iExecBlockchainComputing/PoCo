var RLC            = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub       = artifacts.require("./IexecHub.sol");
var WorkerPoolHub  = artifacts.require("./WorkerPoolHub.sol");
var AppHub         = artifacts.require("./AppHub.sol");
var DatasetHub     = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");
var WorkerPool     = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");

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

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let amountGazProvided = 4000000;
  let isTestRPC;
  let testTimemout = 0;
  let aRLCInstance;
  let aIexecHubInstance;
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aTaskRequestHubInstance;

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
        console.log("transferOwnership of TaskRequestHub to IexecHub")
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
      });
  });

  it("WorkerPool Ceation", function() {
    let workerPoolAddressFromLog;
    return aIexecHubInstance.createWorkerPool("myWorkerPool",false, {
        from: scheduleProvider
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aIexecHubInstance.CreateWorkerPool({}));
      })
      .then(events => {
        assert.strictEqual(events[0].args.workerPoolOwner, scheduleProvider, "workerPoolOwner");
        workerPoolAddressFromLog =events[0].args.workerPool;
        assert.strictEqual(events[0].args.name, "myWorkerPool", "name");
        return aWorkerPoolHubInstance.getWorkerPoolsCount(scheduleProvider);
      })
      .then(count => {
        assert.strictEqual(1, count.toNumber(), "scheduleProvider must have 1 workerPool now ");
        return aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, count);
      })
      .then(workerPoolAddress => {
        assert.strictEqual(workerPoolAddressFromLog, workerPoolAddress, "check workerPoolAddress");
      });
  });


  //check attachWorkerPoolsAuthorizedListContract TODO


});
