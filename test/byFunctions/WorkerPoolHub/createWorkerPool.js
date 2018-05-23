var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var Marketplace = artifacts.require("./Marketplace.sol");

const BN = require("bn");
const keccak256 = require("solidity-sha3");
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

    // USE marketplaceCreator as owner for test. In real deployement ownership is :
    /*
        txMined = await aWorkerPoolHubInstance.setImmutableOwnership(aIexecHubInstance.address, {
          from: marketplaceCreator
        });
    */

  });


  it("createWorkerPool_01 : the owner of ( here marketplaceCreator ) can call createWorkerPool and create several pools", async function() {
    let workerPoolAddressFromLog;
    let subscriptionLockStakePolicy = 1;
    let subscriptionMinimumStakePolicy = 2;
    let subscriptionMinimumScorePolicy = 3;

    let createdWorkerPool = await aWorkerPoolHubInstance.createWorkerPool.call(
      "myWorkerPool 1",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy,
      aMarketplaceInstance.address, {
        from: marketplaceCreator
      });


    let isWorkerPoolRegistered = await aWorkerPoolHubInstance.isWorkerPoolRegistered.call(createdWorkerPool);
    assert.isFalse(isWorkerPoolRegistered, "check isWorkerPoolRegistered false");

    let getWorkerPoolsCount = await aWorkerPoolHubInstance.getWorkerPoolsCount.call(marketplaceCreator);
    assert.strictEqual(getWorkerPoolsCount.toNumber(), 0, "check getWorkerPoolsCount");

    let getWorkerPool = await aWorkerPoolHubInstance.getWorkerPool.call(marketplaceCreator, 1);
    assert.notEqual(getWorkerPool, createdWorkerPool, "check getWorkerPool");


    txMined = await aWorkerPoolHubInstance.createWorkerPool(
      "myWorkerPool 1",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy,
      aMarketplaceInstance.address, {
        from: marketplaceCreator
      });

    aWorkerPoolInstance = await WorkerPool.at(createdWorkerPool);

    let m_subscriptionLockStakePolicyCall = await aWorkerPoolInstance.m_subscriptionLockStakePolicy.call();
    assert.strictEqual(m_subscriptionLockStakePolicyCall.toNumber(), subscriptionLockStakePolicy, "check m_subscriptionLockStakePolicyCall");

    let m_subscriptionMinimumStakePolicyCall = await aWorkerPoolInstance.m_subscriptionMinimumStakePolicy.call();
    assert.strictEqual(m_subscriptionMinimumStakePolicyCall.toNumber(), subscriptionMinimumStakePolicy, "check m_subscriptionMinimumStakePolicyCall");

    let m_subscriptionMinimumScorePolicyCall = await aWorkerPoolInstance.m_subscriptionMinimumScorePolicy.call();
    assert.strictEqual(m_subscriptionMinimumScorePolicyCall.toNumber(), subscriptionMinimumScorePolicy, "check m_subscriptionMinimumScorePolicy");


    isWorkerPoolRegistered = await aWorkerPoolHubInstance.isWorkerPoolRegistered.call(createdWorkerPool);
    assert.isTrue(isWorkerPoolRegistered, "check isWorkerPoolRegistered");

    getWorkerPoolsCount = await aWorkerPoolHubInstance.getWorkerPoolsCount.call(marketplaceCreator);
    assert.strictEqual(getWorkerPoolsCount.toNumber(), 1, "check getWorkerPoolsCount");

    getWorkerPool = await aWorkerPoolHubInstance.getWorkerPool.call(marketplaceCreator, 1);
    assert.strictEqual(getWorkerPool, createdWorkerPool, "check getWorkerPool");

    let createdWorkerPool2 = await aWorkerPoolHubInstance.createWorkerPool.call(
      "myWorkerPool 2",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy,
      aMarketplaceInstance.address, {
        from: marketplaceCreator
      });

    txMined = await aWorkerPoolHubInstance.createWorkerPool(
      "myWorkerPool 2",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy,
      aMarketplaceInstance.address, {
        from: marketplaceCreator
      });

    isWorkerPoolRegistered = await aWorkerPoolHubInstance.isWorkerPoolRegistered.call(createdWorkerPool2);
    assert.isTrue(isWorkerPoolRegistered, "check isWorkerPoolRegistered");

    getWorkerPoolsCount = await aWorkerPoolHubInstance.getWorkerPoolsCount.call(marketplaceCreator);
    assert.strictEqual(getWorkerPoolsCount.toNumber(), 2, "check getWorkerPoolsCount");

    getWorkerPool = await aWorkerPoolHubInstance.getWorkerPool.call(marketplaceCreator, 2);
    assert.strictEqual(getWorkerPool, createdWorkerPool2, "check getWorkerPool 2");

  });


  it("createWorkerPool_02 : a non owner can't call createWorkerPool", async function() {
    let workerPoolAddressFromLog;
    let subscriptionLockStakePolicy = 1;
    let subscriptionMinimumStakePolicy = 2;
    let subscriptionMinimumScorePolicy = 3;

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolHubInstance.createWorkerPool(
          "myWorkerPool 1",
          subscriptionLockStakePolicy,
          subscriptionMinimumStakePolicy,
          subscriptionMinimumScorePolicy,
          aMarketplaceInstance.address, {
            from: iExecCloudUser,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });





});
