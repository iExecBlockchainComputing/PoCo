var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");

/**

// Contracts FULL DEV DEPLOY with new RLC token created

**/

module.exports = function(deployer) {
  let aRLCInstance;
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aIexecHub;
  let aMarketplaceInstance;

  return deployer.deploy(RLC)
    .then(() => RLC.deployed())
    .then(instance => {
      aRLCInstance = instance;
      console.log("RLC deployed at address: " + instance.address);
      return aRLCInstance.unlock();
    })
    .then(() => {
      console.log("RLC unlocked");
      return aRLCInstance.owner.call();
    })
    .then(owner => {
      console.log("RLC faucet wallet is " + owner);
      return aRLCInstance.balanceOf.call(owner);
    })
    .then(faucetSupply => {
      console.log("RLC faucet supply is " + faucetSupply.toNumber());
      return deployer.deploy(WorkerPoolHub);
    })
    .then(() => WorkerPoolHub.deployed())
    .then(instance => {
      aWorkerPoolHubInstance = instance;
      console.log("WorkerPoolHub deployed at address: " + instance.address);
      return deployer.deploy(AppHub);
    })
    .then(() => AppHub.deployed())
    .then(instance => {
      aAppHubInstance = instance;
      console.log("AppHub deployed at address: " + instance.address);
      return deployer.deploy(DatasetHub);
    })
    .then(() => DatasetHub.deployed())
    .then(instance => {
      aDatasetHubInstance = instance;
      console.log("DatasetHub deployed at address: " + instance.address);
      return deployer.deploy(IexecHub, aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address);
    })
    .then(() => IexecHub.deployed())
    .then(instance => {
      aIexecHub = instance;
      console.log("IexecHub deployed at address: " + aIexecHub.address);
      return aWorkerPoolHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of WorkerPoolHub to IexecHub");
      return aAppHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of AppHub to IexecHub");
      return aDatasetHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of DatasetHub to IexecHub");
      return deployer.deploy(Marketplace, aIexecHub.address);
    })
    .then(() => Marketplace.deployed())
    .then(instance => {
      aMarketplaceInstance = instance;
      console.log("Marketplace deployed at address: " + instance.address);
      return aIexecHub.attachMarketplace(instance.address);
    })
    .then(() => {
      console.log("attach Marketplace to IexecHub done");
    });
};

/**

//DEPLOY on existing network having RLC token
//RLC TOKEN address:
//kovan   = '0xc57538846ec405ea25deb00e0f9b29a432d53507'
//rinkeby = '0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90'
//ropsten = '0x7314dc4d7794b5e7894212ca1556ae8e3de58621'
//mainnet = '0x607F4C5BB672230e8672085532f7e901544a7375'

module.exports = function(deployer) {
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aTaskRequestHubInstance;
  let aIexecHub;
  return deployer.deploy(WorkerPoolHub)
    .then(() => WorkerPoolHub.deployed())
    .then(instance => {
      aWorkerPoolHubInstance = instance;
      console.log("WorkerPoolHub deployed at address: " + instance.address);
      return deployer.deploy(AppHub);
    })
    .then(() => AppHub.deployed())
    .then(instance => {
      aAppHubInstance = instance;
      console.log("AppHub deployed at address: " + instance.address);
      return deployer.deploy(DatasetHub);
    })
    .then(() => DatasetHub.deployed())
    .then(instance => {
      aDatasetHubInstance = instance;
      console.log("DatasetHub deployed at address: " + instance.address);
      return deployer.deploy(TaskRequestHub);
    })
    .then(() => TaskRequestHub.deployed())
    .then(instance => {
      aTaskRequestHubInstance = instance;
      console.log("TaskRequestHub deployed at address: " + instance.address);
      return deployer.deploy(IexecHub, '0x7314dc4d7794b5e7894212ca1556ae8e3de58621', aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address);
    })
    .then(() => IexecHub.deployed())
    .then(instance => {
      aIexecHub = instance;
      console.log("IexecHub deployed at address: " + aIexecHub.address);
      return aWorkerPoolHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of WorkerPoolHub to IexecHub");
      return aAppHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of AppHub to IexecHub");
      return aDatasetHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of DatasetHub to IexecHub");
      return aTaskRequestHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => console.log("transferOwnership of TaskRequestHub to IexecHub"));
};

**/
