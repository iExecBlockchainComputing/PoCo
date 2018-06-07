var RLC         = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub    = artifacts.require("./IexecHub.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var DappHub     = artifacts.require("./DappHub.sol");
var DataHub     = artifacts.require("./DataHub.sol");
var PoolHub     = artifacts.require("./PoolHub.sol");
// var WorkerPool       = artifacts.require("./Pool.sol");

const fs            = require("fs-extra");
const Promise       = require("bluebird");
const readFileAsync = Promise.promisify(fs.readFile);

/**
 * Contracts FULL DEV DEPLOY with new RLC token created
 */

module.exports = function(deployer) {
	let aRLCInstance;
	let aIexecHub;
	let aMarketplaceInstance;
	let aDappHubInstance;
	let aDataHubInstance;
	let aPoolHubInstance;
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
			return deployer.deploy(IexecHub);
		})
		.then(() => IexecHub.deployed())
		.then(instance => {
			aIexecHub = instance;
			console.log("IexecHub deployed at address: " + aIexecHub.address);
			return deployer.deploy(Marketplace, aRLCInstance.address, aIexecHub.address);
		})
		.then(() => Marketplace.deployed())
		.then(instance => {
			aMarketplaceInstance = instance;
			console.log("Marketplace deployed at address: " + instance.address);
			return deployer.deploy(DappHub);
		})
		.then(() => DappHub.deployed())
		.then(instance => {
			aDappHubInstance = instance;
			console.log("DappHub deployed at address: " + instance.address);
			return deployer.deploy(DataHub);
		})
		.then(() => DataHub.deployed())
		.then(instance => {
			aDataHubInstance = instance;
			console.log("DataHub deployed at address: " + instance.address);
			return deployer.deploy(PoolHub);
		})
		.then(() => PoolHub.deployed())
		.then(instance => {
			aPoolHubInstance = instance;
			console.log("PoolHub deployed at address: " + instance.address);
			return aDappHubInstance.transferOwnership(aIexecHub.address);
		})
		.then(() => {
			console.log("transferOwnership of DappHub to IexecHub");
			return aDataHubInstance.transferOwnership(aIexecHub.address);
		})
		.then(() => {
			console.log("transferOwnership of DataHub to IexecHub");
			return aPoolHubInstance.transferOwnership(aIexecHub.address);
		})
		.then(() => {
			console.log("transferOwnership of PoolHub to IexecHub");
			return aIexecHub.attachContracts(
				aMarketplaceInstance.address,
				aDappHubInstance.address,
				aDataHubInstance.address,
				aPoolHubInstance.address
			);
		})
		.then(() => {
			console.log("attach Contracts to IexecHub done");
			return aIexecHub.transferOwnership(creator);
		})
		.then(() => {
			console.log("setCategoriesCreator to "+creator);
			return readFileAsync("./config/categories.json");
		})
		.then(categories => {
			createCatagoriesPromises = [];
			var categoriesConfigFileJson = JSON.parse(categories);
			for(var i = 0; i < categoriesConfigFileJson.categories.length; ++i)
			{
				console.log("create category : "+categoriesConfigFileJson.categories[i].name);
				createCatagoriesPromises.push(aIexecHub.createCategoryLegacy(
					categoriesConfigFileJson.categories[i].name,
					JSON.stringify(categoriesConfigFileJson.categories[i].description),
					categoriesConfigFileJson.categories[i].workClockTimeRef
				));
			}
			return Promise.all(createCatagoriesPromises);
		})
		.then(categoriesCreated => {
			return aIexecHub.countCategory.call()
		})
		.then(countCategory => {
			console.log("countCategory is now: "+countCategory)
		});
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
	aRLCInstance='0xc57538846ec405ea25deb00e0f9b29a432d53507';

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
			return deployer.deploy(IexecHub);
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
			console.log("create category : "+categoriesConfigFileJson.categories[5].name);
			return aIexecHub.createCategory(categoriesConfigFileJson.categories[5].name,JSON.stringify(categoriesConfigFileJson.categories[5].description),categoriesConfigFileJson.categories[5].workClockTimeRef);
		})
		.then(categoriesCreated => {
			return aIexecHub.m_categoriesCount.call()
		})
		.then(m_categoriesCount => console.log("m_categoriesCount is now: "+m_categoriesCount))
		;

};
*/
