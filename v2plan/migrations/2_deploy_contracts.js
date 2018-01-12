var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var DappHub = artifacts.require("./DappHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");

module.exports = function(deployer) {
  let aWorkerPoolHubInstance;
  let aDappHubInstance;
  let aDatasetHubInstance;
  let aTaskRequestHubInstance;
  let aIexecHub;
  return deployer.deploy(WorkerPoolHub)
    .then(() => WorkerPoolHub.deployed())
    .then(instance => {
      aWorkerPoolHubInstance = instance;
      console.log("WorkerPoolHub deployed at address :" + instance.address);
      return deployer.deploy(DappHub);
    })
    .then(() => DappHub.deployed())
    .then(instance => {
      aDappHubInstance = instance;
      console.log("DappHub deployed at address :" + instance.address);
      return deployer.deploy(DatasetHub);
    })
    .then(() => DatasetHub.deployed())
    .then(instance => {
      aDatasetHubInstance = instance;
      console.log("DatasetHub deployed at address :" + instance.address);
      return deployer.deploy(TaskRequestHub);
    })
    .then(() => TaskRequestHub.deployed())
    .then(instance => {
      aTaskRequestHubInstance = instance;
      console.log("TaskRequestHub deployed at address :" + instance.address);
      return deployer.deploy(IexecHub, '0x7314dc4d7794b5e7894212ca1556ae8e3de58621', aWorkerPoolHubInstance.address, aDappHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address);
    })
    .then(() => IexecHub.deployed())
    .then(instance => {
      aIexecHub = instance;
      console.log("IexecHub deployed at address :" + aIexecHub.address);
      return aWorkerPoolHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of WorkerPoolHub to IexecHub");
      return aDappHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of DappHub to IexecHub");
      return aDatasetHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("transferOwnership of DatasetHub to IexecHub");
      return aTaskRequestHubInstance.transferOwnership(aIexecHub.address);
    })
    .then(() => console.log("transferOwnership of TaskRequestHub to IexecHub"));
};


/*
RLC TOKEN address :
kovan   = '0xc57538846ec405ea25deb00e0f9b29a432d53507'
rinkeby = '0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90'
ropsten = '0x7314dc4d7794b5e7894212ca1556ae8e3de58621'
mainnet = '0x607F4C5BB672230e8672085532f7e901544a7375'
 */
