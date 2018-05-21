var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
const fs = require("fs-extra");
const Promise = require("bluebird");
const readFileAsync = Promise.promisify(fs.readFile);
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
  let creator;
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
      creator = owner;
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
      return deployer.deploy(IexecHub);
    })
    .then(() => IexecHub.deployed())
    .then(instance => {
      aIexecHub = instance;
      console.log("IexecHub deployed at address: " + aIexecHub.address);
      return aWorkerPoolHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of WorkerPoolHub to IexecHub");
      return aAppHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of AppHub to IexecHub");
      return aDatasetHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of DatasetHub to IexecHub");
      return deployer.deploy(Marketplace, aIexecHub.address);
    })
    .then(() => Marketplace.deployed())
    .then(instance => {
      aMarketplaceInstance = instance;
      console.log("Marketplace deployed at address: " + instance.address);
      return aIexecHub.attachContracts(aRLCInstance.address, aMarketplaceInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address);
    })
    .then(() => {
      console.log("attach Contracts to IexecHub done");
      return aIexecHub.setCategoriesCreator(creator);
    })
    .then(() => {
      console.log("setCategoriesCreator to " + creator);
      return readFileAsync("./config/categories.json");
    })
    .then(categories => {
      var categoriesConfigFileJson = JSON.parse(categories);
      catagoriesPromises = [];
      for (var i = 0; i < categoriesConfigFileJson.categories.length; i++) {
        console.log("create category : " + categoriesConfigFileJson.categories[i].name);
        catagoriesPromises.push(aIexecHub.createCategory(categoriesConfigFileJson.categories[i].name, JSON.stringify(categoriesConfigFileJson.categories[i].description), categoriesConfigFileJson.categories[i].workClockTimeRef));
      }
      return Promise.all(catagoriesPromises);
    })
    .then(categoriesCreated => {
      return aIexecHub.m_categoriesCount.call()
    })
    .then(m_categoriesCount => console.log("m_categoriesCount is now: " + m_categoriesCount));
};

/**

//DEPLOY on existing network having RLC token
//RLC TOKEN address:
//kovan   = '0xc57538846ec405ea25deb00e0f9b29a432d53507'
//rinkeby = '0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90'
//ropsten = '0x7314dc4d7794b5e7894212ca1556ae8e3de58621'
//mainnet = '0x607F4C5BB672230e8672085532f7e901544a7375'
*/
/*
module.exports = function(deployer) {
  let aRLCInstance;
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aIexecHub;
  let aMarketplaceInstance;
  let categoriesConfigFileJson;
  let creator ='0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC';
  aRLCInstance='0x7314dc4d7794b5e7894212ca1556ae8e3de58621';

  return deployer.deploy(WorkerPoolHub,{gas: 4685012})
    .then(() => WorkerPoolHub.deployed())
    .then(instance => {
      aWorkerPoolHubInstance = instance;
      console.log("WorkerPoolHub deployed at address: " + instance.address);
      return deployer.deploy(AppHub,{gas: 4685012});
    })
    .then(() => AppHub.deployed())
    .then(instance => {
      aAppHubInstance = instance;
      console.log("AppHub deployed at address: " + instance.address);
      return deployer.deploy(DatasetHub,{gas: 4685012});
    })
    .then(() => DatasetHub.deployed())
    .then(instance => {
      aDatasetHubInstance = instance;
      console.log("DatasetHub deployed at address: " + instance.address);
      return deployer.deploy(IexecHub,{gas: 4685012});
    })
    .then(() => IexecHub.deployed())
    .then(instance => {
      aIexecHub = instance;
      console.log("IexecHub deployed at address: " + aIexecHub.address);
      return aWorkerPoolHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of WorkerPoolHub to IexecHub");
      return aAppHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of AppHub to IexecHub");
      return aDatasetHubInstance.setImmutableOwnership(aIexecHub.address);
    })
    .then(() => {
      console.log("setImmutableOwnership of DatasetHub to IexecHub");
      return deployer.deploy(Marketplace, aIexecHub.address,{gas: 4685012});
    })
    .then(() => Marketplace.deployed())
    .then(instance => {
      aMarketplaceInstance = instance;
      console.log("Marketplace deployed at address: " + instance.address);
      return aIexecHub.attachContracts(aRLCInstance,aMarketplaceInstance.address,aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address);
    })
    .then(() => {
      console.log("attach Contracts to IexecHub done");
      return aIexecHub.setCategoriesCreator(creator);
    })
    .then(() => {
      console.log("setCategoriesCreator to "+creator);
      return readFileAsync("./config/categories.json");
    })
    .then(categories => {
      categoriesConfigFileJson = JSON.parse(categories);
      console.log("create category : "+categoriesConfigFileJson.categories[0].name);
      return aIexecHub.createCategory(categoriesConfigFileJson.categories[0].name,JSON.stringify(categoriesConfigFileJson.categories[0].description),categoriesConfigFileJson.categories[0].workClockTimeRef);
    })
    .then(categoriesCreated => {
      console.log("create category : "+categoriesConfigFileJson.categories[1].name);
      return aIexecHub.createCategory(categoriesConfigFileJson.categories[1].name,JSON.stringify(categoriesConfigFileJson.categories[1].description),categoriesConfigFileJson.categories[1].workClockTimeRef);
    })
    .then(categoriesCreated => {
      console.log("create category : "+categoriesConfigFileJson.categories[2].name);
      return aIexecHub.createCategory(categoriesConfigFileJson.categories[2].name,JSON.stringify(categoriesConfigFileJson.categories[2].description),categoriesConfigFileJson.categories[2].workClockTimeRef);
    })
    .then(categoriesCreated => {
      console.log("create category : "+categoriesConfigFileJson.categories[3].name);
      return aIexecHub.createCategory(categoriesConfigFileJson.categories[3].name,JSON.stringify(categoriesConfigFileJson.categories[3].description),categoriesConfigFileJson.categories[3].workClockTimeRef);
    })
    .then(categoriesCreated => {
      console.log("create category : "+categoriesConfigFileJson.categories[4].name);
      return aIexecHub.createCategory(categoriesConfigFileJson.categories[4].name,JSON.stringify(categoriesConfigFileJson.categories[4].description),categoriesConfigFileJson.categories[4].workClockTimeRef);
    })
    .then(categoriesCreated => {
      return aIexecHub.m_categoriesCount.call()
    })
    .then(m_categoriesCount => console.log("m_categoriesCount is now: "+m_categoriesCount))
    ;

};*/
