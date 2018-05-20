var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var App = artifacts.require("./App.sol");

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
  let subscriptionLockStakePolicy = 6;
  let subscriptionMinimumStakePolicy = 4;
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

    // WORKER ADD deposit to respect workerpool policy
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    // WORKER ADD deposit to respect workerpool policy
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

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


  it("contribute_01: resourceProvider,resourceProvider2 are allowed to contribute", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
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

    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //check resourceProvider
    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Contribute({
      worker: resourceProvider
    }), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");
    assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");
    assert.strictEqual(events[0].args.resultHash, signed.hash, "check resultHash");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");

    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    //check resourceProvider2
    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Contribute({
      worker: resourceProvider2
    }), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");
    assert.strictEqual(events[0].args.worker, resourceProvider2, "check worker");
    assert.strictEqual(events[0].args.resultHash, signed.hash, "check resultHash");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider2);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");

    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");

    getContributorsCount = await aWorkerPoolInstance.getContributorsCount.call(woid);
    assert.strictEqual(getContributorsCount.toNumber(), 2, "check getContributorsCount");


    getContributor0 = await aWorkerPoolInstance.getContributor.call(woid, 0);
    assert.strictEqual(getContributor0, resourceProvider, "check getContributor0");

    getContributor1 = await aWorkerPoolInstance.getContributor.call(woid, 1);
    assert.strictEqual(getContributor1, resourceProvider2, "check getContributor1");

  });



  it("contribute_02: resourceProvider can't contribute with _resultHash = 0", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, 0, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });




  it("contribute_03: resourceProvider can't contribute with _resultSign = 0", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });


    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");

    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, 0, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("contribute_04: resourceProvider not AUTHORIZED can't contribute", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");

    //in this test resourceProvider is not allowed to contribute
    /*    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
          from: scheduleProvider
        });

        [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
        assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    */
    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("contribute_05: resourceProvider can't contribute on wrong woid", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");

    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(resourceProvider /*test wrong WOID*/ , signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("contribute_06: resourceProvider can't contribute if he has not enough deposit for the reward ratio stake", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });


    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    /*
    For this test :resourceProvider can't contribute if he has not enough deposit for the reward ratio stake
        txMined = await aIexecHubInstance.deposit(30, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
    */

    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });



  it("contribute_07: resourceProvider can't contribute twice", async function() {

    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });

  it("contribute_08: resourceProvider can't contribute after the consensus timeout", async function() {
		if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise((CONSENSUS_DURATION_RATIO*CategoryWorkClockTimeRef)+1);
    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);


  });


  //TODO test contribute with challenge enclave
  //TODO check this : (,contribution.score)   = iexecHubInterface.getWorkerStatus(msg.sender);

});
