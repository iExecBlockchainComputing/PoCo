var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
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

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator,resourceProvider2;
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

    await Extensions.makeSureAreUnlocked(
      [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser,resourceProvider2]);
    let balance = await web3.eth.getBalancePromise(scheduleProvider);
    assert.isTrue(
      web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
      "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
    await Extensions.refillAccount(scheduleProvider, resourceProvider, 10);
		await Extensions.refillAccount(scheduleProvider, resourceProvider2, 10);
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
			aRLCInstance.transfer(resourceProvider2, 1000, {
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
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    let balances = await Promise.all([
      aRLCInstance.balanceOf(scheduleProvider),
      aRLCInstance.balanceOf(resourceProvider),
			aRLCInstance.balanceOf(resourceProvider2),
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
  });


  it("subscribeToPool_01 : resourceProvider can Subscribe if he has enought deposit", async function() {
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), subscriptionMinimumStakePolicy, "check stake of the resourceProvider");
    assert.strictEqual(checkBalance[1].toNumber(), subscriptionLockStakePolicy, "check stake locked of the resourceProvider");
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    getWorkersCount = await aWorkerPoolInstance.getWorkersCount.call();
    assert.strictEqual(getWorkersCount.toNumber(), 1, "getWorkersCount");

    getWorkerIndex = await aWorkerPoolInstance.getWorkerIndex.call(resourceProvider);
    assert.strictEqual(getWorkerIndex.toNumber(), 0, "getWorkerIndex");

    getWorkerAddress = await aWorkerPoolInstance.getWorkerAddress.call(getWorkerIndex);
    assert.strictEqual(getWorkerAddress, resourceProvider, "getWorkerAddress");

    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkerPoolSubscription({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");
    assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerSubscribe({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");

		getWorkerAffectation = await aWorkerPoolHubInstance.getWorkerAffectation.call(resourceProvider);
    assert.strictEqual(getWorkerAffectation, aWorkerPoolInstance.address, "getWorkerAffectation");

  });


  it("subscribeToPool_02 : resourceProvider can't Subscribe to an other pool if already affected to one pool", async function() {

    txMined = await aIexecHubInstance.createWorkerPool(
      "myWorkerPool 2",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy, {
        from: scheduleProvider
      });

    workerPoolAddress2 = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 2);
    aWorkerPoolInstance2 = await WorkerPool.at(workerPoolAddress2);

    txMined = await aIexecHubInstance.deposit(100, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 94, "check stake of the resourceProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 6, "check stake locked of the resourceProvider");
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    getWorkersCount = await aWorkerPoolInstance.getWorkersCount.call();
    assert.strictEqual(getWorkersCount.toNumber(), 1, "getWorkersCount");

    getWorkerIndex = await aWorkerPoolInstance.getWorkerIndex.call(resourceProvider);
    assert.strictEqual(getWorkerIndex.toNumber(), 0, "getWorkerIndex");

    getWorkerAddress = await aWorkerPoolInstance.getWorkerAddress.call(getWorkerIndex);
    assert.strictEqual(getWorkerAddress, resourceProvider, "getWorkerAddress");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerSubscribe({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance2.subscribeToPool({
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });

  it("subscribeToPool_03 :resourceProvider can't  Subscribe if he has not enought deposit", async function() {
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.subscribeToPool({
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);
  });


	it("subscribeToPool_04 : direct call to registerToPool on aIexecHubInstance must failed ", async function() {
		txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
			from: resourceProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		await Extensions.expectedExceptionPromise(() => {
        return aIexecHubInstance.registerToPool(resourceProvider,{
					from: resourceProvider,
					gas: constants.AMOUNT_GAS_PROVIDED
				});
      },
      constants.AMOUNT_GAS_PROVIDED);

	});

	it("subscribeToPool_05 : multiple resourceProviders  can Subscribe to worker pool", async function() {
		txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
			from: resourceProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		txMined = await aWorkerPoolInstance.subscribeToPool({
			from: resourceProvider,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
		assert.strictEqual(checkBalance[0].toNumber(), subscriptionMinimumStakePolicy, "check stake of the resourceProvider");
		assert.strictEqual(checkBalance[1].toNumber(), subscriptionLockStakePolicy, "check stake locked of the resourceProvider");
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		getWorkersCount = await aWorkerPoolInstance.getWorkersCount.call();
		assert.strictEqual(getWorkersCount.toNumber(), 1, "getWorkersCount");

		getWorkerIndex = await aWorkerPoolInstance.getWorkerIndex.call(resourceProvider);
		assert.strictEqual(getWorkerIndex.toNumber(), 0, "getWorkerIndex");

		getWorkerAddress = await aWorkerPoolInstance.getWorkerAddress.call(getWorkerIndex);
		assert.strictEqual(getWorkerAddress, resourceProvider, "getWorkerAddress");

		events = await Extensions.getEventsPromise(aIexecHubInstance.WorkerPoolSubscription({}), 1, constants.EVENT_WAIT_TIMEOUT);
		assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");
		assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");

		events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerSubscribe({}), 1, constants.EVENT_WAIT_TIMEOUT);
		assert.strictEqual(events[0].args.worker, resourceProvider, "check worker");

		getWorkerAffectation = await aWorkerPoolHubInstance.getWorkerAffectation.call(resourceProvider);
		assert.strictEqual(getWorkerAffectation, aWorkerPoolInstance.address, "getWorkerAffectation");

		txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
			from: resourceProvider2,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		txMined = await aWorkerPoolInstance.subscribeToPool({
			from: resourceProvider2,
			gas: constants.AMOUNT_GAS_PROVIDED
		});
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
		assert.strictEqual(checkBalance[0].toNumber(), subscriptionMinimumStakePolicy, "check stake of the resourceProvider");
		assert.strictEqual(checkBalance[1].toNumber(), subscriptionLockStakePolicy, "check stake locked of the resourceProvider");
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		getWorkersCount = await aWorkerPoolInstance.getWorkersCount.call();
		assert.strictEqual(getWorkersCount.toNumber(), 2, "getWorkersCount");

		getWorkerIndex = await aWorkerPoolInstance.getWorkerIndex.call(resourceProvider2);
		assert.strictEqual(getWorkerIndex.toNumber(), 1, "getWorkerIndex");

		getWorkerAddress = await aWorkerPoolInstance.getWorkerAddress.call(getWorkerIndex);
		assert.strictEqual(getWorkerAddress, resourceProvider2, "getWorkerAddress");

		events = await Extensions.getEventsPromise(aIexecHubInstance.WorkerPoolSubscription({}), 1, constants.EVENT_WAIT_TIMEOUT);
		assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");
		assert.strictEqual(events[0].args.worker, resourceProvider2, "check worker");

		events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkerSubscribe({}), 1, constants.EVENT_WAIT_TIMEOUT);
		assert.strictEqual(events[0].args.worker, resourceProvider2, "check worker");

		getWorkerAffectation = await aWorkerPoolHubInstance.getWorkerAffectation.call(resourceProvider2);
		assert.strictEqual(getWorkerAffectation, aWorkerPoolInstance.address, "getWorkerAffectation");

	});



	//TODO check m_subscriptionMinimumScorePolicy


});
