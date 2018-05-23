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
  let subscriptionMinimumStakePolicy = 10;
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
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
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

  });

  it("createMarketOrder_01 : a owner (scheduleProvider) of worker pool can emit a ASK Market Order on an existing category", async function() {

    txMined = await aMarketplaceInstance.createMarketOrder(
      constants.MarketOrderDirectionEnum.ASK,
      1 /*_category*/ ,
      0 /*_trust*/ ,
      100 /*_value*/ ,
      workerPoolAddress /*_workerpool of scheduler*/ ,
      1 /*_volume*/ , {
        from: scheduleProvider
      });

    events = await Extensions.getEventsPromise(aMarketplaceInstance.MarketOrderCreated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.marketorderIdx.toNumber(), 1, "marketorderIdx");

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(1);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 1, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 100, "check value");
    assert.strictEqual(volume.toNumber(), 1, "check volume");
    assert.strictEqual(remaining.toNumber(), 1, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");


  });


  it("createMarketOrder_02 : a non owner of worker pool can't emit a ASK Market Order on an existing category", async function() {

    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.ASK,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: iExecCloudUser,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("createMarketOrder_03 : if cataegory do not exist the ask order must not be emitted", async function() {

    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.ASK,
          0 /*_category 0 do not exist. must revert*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("createMarketOrder_04 : BID not yet implemented", async function() {
    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.BID,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });

  it("createMarketOrder_05 : can't createMarketOrder with MarketOrderDirectionEnum to CLOSED", async function() {
    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.CLOSED,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });

  it("createMarketOrder_06 : MarketOrderDirectionEnum must be set", async function() {
    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.UNSET,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });


  it("createMarketOrder_07 : a owner (scheduleProvider) of worker pool can't emit a ASK Market Order of value 101 if he has only deposit 100", async function() {

    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.ASK,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          350 /*_value*/ , // only deposit 100 so must revert. 30%350 = 105 > 100
          workerPoolAddress /*_workerpool of scheduler*/ ,
          1 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("createMarketOrder_08 : a owner (scheduleProvider) of worker pool can emit a ASK Market Order if deposit >= value * volume", async function() {
    // 100 RLC deposit <= volume (2) * value (50)

    txMined = await aMarketplaceInstance.createMarketOrder(
      constants.MarketOrderDirectionEnum.ASK,
      1 /*_category*/ ,
      0 /*_trust*/ ,
      50 /*_value*/ ,
      workerPoolAddress /*_workerpool of scheduler*/ ,
      2 /*_volume*/ , {
        from: scheduleProvider
      });

    events = await Extensions.getEventsPromise(aMarketplaceInstance.MarketOrderCreated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.marketorderIdx.toNumber(), 1, "marketorderIdx");

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(1);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 1, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 50, "check value");
    assert.strictEqual(volume.toNumber(), 2, "check volume");
    assert.strictEqual(remaining.toNumber(), 2, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");

  });

  it("createMarketOrder_09 : a owner (scheduleProvider) of worker pool can't emit a ASK Market Order if deposit < value * volume", async function() {
    // 100 RLC deposit < volume (2) * value (51)
    await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.ASK,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          175 /*_value*/ , // 175 * 2 * 30% => 105 > 100
          workerPoolAddress /*_workerpool of scheduler*/ ,
          2 /*_volume*/ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("createMarketOrder_10 : a owner (scheduleProvider) of worker pool can't emit a ASK Market Order with volume = 0", async function() {
    return await Extensions.expectedExceptionPromise(() => {
        return aMarketplaceInstance.createMarketOrder(
          constants.MarketOrderDirectionEnum.ASK,
          1 /*_category*/ ,
          0 /*_trust*/ ,
          100 /*_value*/ ,
          workerPoolAddress /*_workerpool of scheduler*/ ,
          0 /*_volume = 0 => revert */ , {
            from: scheduleProvider,
            gas: constants.AMOUNT_GAS_PROVIDED
          });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("createMarketOrder_11 : a owner (scheduleProvider) of worker pool can emit several ASK Market Orders if enought deposit ", async function() {

    txMined = await aRLCInstance.approve(aIexecHubInstance.address, 100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
		assert.strictEqual(checkBalance[0].toNumber(), 200, "check stake of the scheduleProvider");
		assert.strictEqual(checkBalance[1].toNumber(),  0, "check stake locked of the scheduleProvider");
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    txMined = await aMarketplaceInstance.createMarketOrder(
      constants.MarketOrderDirectionEnum.ASK,
      1 /*_category*/ ,
      0 /*_trust*/ ,
      50 /*_value*/ ,
      workerPoolAddress /*_workerpool of scheduler*/ ,
      2 /*_volume*/ , {
        from: scheduleProvider
      });

    events = await Extensions.getEventsPromise(aMarketplaceInstance.MarketOrderCreated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.marketorderIdx.toNumber(), 1, "marketorderIdx");

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(1);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 1, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 50, "check value");
    assert.strictEqual(volume.toNumber(), 2, "check volume");
    assert.strictEqual(remaining.toNumber(), 2, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 170, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(),  30, "check stake locked of the scheduleProvider.");

    txMined = await aMarketplaceInstance.createMarketOrder(
      constants.MarketOrderDirectionEnum.ASK,
      2 /*_category*/ ,
      0 /*_trust*/ ,
      25 /*_value*/ ,
      workerPoolAddress /*_workerpool of scheduler*/ ,
      4 /*_volume*/ , {
        from: scheduleProvider
      });

    events = await Extensions.getEventsPromise(aMarketplaceInstance.MarketOrderCreated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.marketorderIdx.toNumber(), 2, "marketorderIdx");

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(2);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 2, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 25, "check value");
    assert.strictEqual(volume.toNumber(), 4, "check volume");
    assert.strictEqual(remaining.toNumber(), 4, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");

    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 142, "check stake of the scheduleProvider");
    assert.strictEqual(checkBalance[1].toNumber(),  58, "check stake locked of the scheduleProvider. floor(25 * 0.3) * 4 = 28 . previous 30 + 28 = 58");



  });

  it("createMarketOrder_12 : a owner (scheduleProvider) of worker pool can emit a ASK Market Order for free = value 0", async function() {

    txMined = await aMarketplaceInstance.createMarketOrder(
      constants.MarketOrderDirectionEnum.ASK,
      1 /*_category*/ ,
      0 /*_trust*/ ,
      0 /*_value*/ ,
      workerPoolAddress /*_workerpool of scheduler*/ ,
      1 /*_volume*/ , {
        from: scheduleProvider
      });

    events = await Extensions.getEventsPromise(aMarketplaceInstance.MarketOrderCreated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.marketorderIdx.toNumber(), 1, "marketorderIdx");

    [direction, category, trust, value, volume, remaining, workerpool, workerpoolOwner] = await aMarketplaceInstance.getMarketOrder.call(1);
    assert.strictEqual(direction.toNumber(), constants.MarketOrderDirectionEnum.ASK, "check constants.MarketOrderDirectionEnum.ASK");
    assert.strictEqual(category.toNumber(), 1, "check category");
    assert.strictEqual(trust.toNumber(), 0, "check trust");
    assert.strictEqual(value.toNumber(), 0, "check value");
    assert.strictEqual(volume.toNumber(), 1, "check volume");
    assert.strictEqual(remaining.toNumber(), 1, "check remaining");
    assert.strictEqual(workerpool, workerPoolAddress, "check workerpool");
    assert.strictEqual(workerpoolOwner, scheduleProvider, "check workerpoolOwner");


  });



});
