var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Beacon       = artifacts.require("./Beacon.sol");
var Broker       = artifacts.require("./Broker.sol");

var IexecODBLibOrders = artifacts.require("./IexecODBLibOrders.sol");
var TestContract      = artifacts.require("./TestContract.sol");

const fs = require("fs-extra");

module.exports = async function(deployer, network, accounts)
{

	await deployer.deploy(RLC);
	RLCInstance = await RLC.deployed();
	console.log("RLC deployed at address: " + RLCInstance.address);

	await RLCInstance.unlock();
	console.log("RLC unlocked");

	owner = await RLCInstance.owner.call()
	console.log("RLC faucet wallet is " + owner);
	console.log("RLC faucet supply is " + await RLCInstance.balanceOf(owner));

	await deployer.deploy(IexecODBLibOrders);
	await deployer.link(IexecODBLibOrders, IexecClerk);
	await deployer.link(IexecODBLibOrders, TestContract);

	await deployer.deploy(IexecHub);
	IexecHubInstance = await IexecHub.deployed();
	console.log("IexecHub deployed at address: " + IexecHubInstance.address);

	await deployer.deploy(IexecClerk, RLCInstance.address, IexecHubInstance.address);
	IexecClerkInstance = await IexecClerk.deployed();
	console.log("IexecClerk deployed at address: " + IexecClerkInstance.address);

	await deployer.deploy(DappRegistry);
	await deployer.deploy(DataRegistry);
	await deployer.deploy(PoolRegistry);
	DappRegistryInstance = await DappRegistry.deployed();
	DataRegistryInstance = await DataRegistry.deployed();
	PoolRegistryInstance = await PoolRegistry.deployed();
	console.log("DappRegistry deployed at address: " + DappRegistryInstance.address);
	console.log("DataRegistry deployed at address: " + DataRegistryInstance.address);
	console.log("PoolRegistry deployed at address: " + PoolRegistryInstance.address);
	// transferOwnership if ownable

	await IexecHubInstance.attachContracts(
		IexecClerkInstance.address
	, DappRegistryInstance.address
	, DataRegistryInstance.address
	, PoolRegistryInstance.address
	);
	console.log("attach Contracts to IexecHub done");
	await IexecHubInstance.transferOwnership(owner);
	console.log("setCategoriesCreator to " + owner);

	var categoriesConfigFileJson = JSON.parse(fs.readFileSync("./config/categories.json"));
	for(var i = 0; i < categoriesConfigFileJson.categories.length; ++i)
	{
		console.log("create category : " + categoriesConfigFileJson.categories[i].name);
		await IexecHubInstance.createCategory(
			categoriesConfigFileJson.categories[i].name
		,	JSON.stringify(categoriesConfigFileJson.categories[i].description)
		,	categoriesConfigFileJson.categories[i].workClockTimeRef
		);
	}
	console.log("countCategory is now: " + await IexecHubInstance.countCategory());


	


	await deployer.deploy(Beacon);
	await deployer.deploy(Broker, IexecClerkInstance.address);
	BeaconInstance = await Beacon.deployed();
	BrokerInstance = await Broker.deployed();
	console.log("Beacon deployed at address: " + BeaconInstance.address);
	console.log("Broker deployed at address: " + BrokerInstance.address);

	await deployer.deploy(TestContract);
	IexecODBLibOrdersInstance = await IexecODBLibOrders.deployed();
	TestContractInstance      = await TestContract.deployed();
	console.log("IexecODBLibOrders deployed at address: " + IexecODBLibOrdersInstance.address);
	console.log("TestContract deployed at address: " + TestContractInstance.address);

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
	let aWorkerPoolRegistryInstance;
	let aAppHubInstance;
	let aDatasetHubInstance;
	let aIexecHubInstance;
	let aIexecClerkInstance;
	let categoriesConfigFileJson;
	let creator ='0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC';
	aRLCInstance='0xc57538846ec405ea25deb00e0f9b29a432d53507';

	return deployer.deploy(WorkerPoolRegistry)
		.then(() => WorkerPoolRegistry.deployed())
		.then(instance => {
			aWorkerPoolRegistryInstance = instance;
			console.log("WorkerPoolRegistry deployed at address: " + instance.address);
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
			aIexecHubInstance = instance;
			console.log("IexecHub deployed at address: " + aIexecHubInstance.address);
			return aWorkerPoolRegistryInstance.transferOwnership(aIexecHubInstance.address);
		})
		.then(() => {
			console.log("transferOwnership of WorkerPoolRegistry to IexecHub");
			return aAppHubInstance.transferOwnership(aIexecHubInstance.address);
		})
		.then(() => {
			console.log("transferOwnership of AppHub to IexecHub");
			return aDatasetHubInstance.transferOwnership(aIexecHubInstance.address);
		})
		.then(() => {
			console.log("transferOwnership of DatasetHub to IexecHub");
			return deployer.deploy(Marketplace, aIexecHubInstance.address);
		})
		.then(() => Marketplace.deployed())
		.then(instance => {
			aIexecClerkInstance = instance;
			console.log("Marketplace deployed at address: " + instance.address);
			return aIexecHubInstance.attachContracts(aRLCInstance,aIexecClerkInstance.address,aWorkerPoolRegistryInstance.address, aAppHubInstance.address, aDatasetHubInstance.address);
		})
		.then(() => {
			console.log("attach Contracts to IexecHub done");
			return aIexecHubInstance.setCategoriesCreator(creator);
		})
		.then(() => {
			console.log("setCategoriesCreator to "+creator);
			return readFileAsync("./config/categories.json");
		})
		.then(categories => {
			categoriesConfigFileJson = JSON.parse(categories);
			console.log("create category : "+categoriesConfigFileJson.categories[0].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[0].name,JSON.stringify(categoriesConfigFileJson.categories[0].description),categoriesConfigFileJson.categories[0].workClockTimeRef);
		})
		.then(categoriesCreated => {
			console.log("create category : "+categoriesConfigFileJson.categories[1].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[1].name,JSON.stringify(categoriesConfigFileJson.categories[1].description),categoriesConfigFileJson.categories[1].workClockTimeRef);
		})
		.then(categoriesCreated => {
			console.log("create category : "+categoriesConfigFileJson.categories[2].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[2].name,JSON.stringify(categoriesConfigFileJson.categories[2].description),categoriesConfigFileJson.categories[2].workClockTimeRef);
		})
		.then(categoriesCreated => {
			console.log("create category : "+categoriesConfigFileJson.categories[3].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[3].name,JSON.stringify(categoriesConfigFileJson.categories[3].description),categoriesConfigFileJson.categories[3].workClockTimeRef);
		})
		.then(categoriesCreated => {
			console.log("create category : "+categoriesConfigFileJson.categories[4].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[4].name,JSON.stringify(categoriesConfigFileJson.categories[4].description),categoriesConfigFileJson.categories[4].workClockTimeRef);
		})
		.then(categoriesCreated => {
			console.log("create category : "+categoriesConfigFileJson.categories[5].name);
			return aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[5].name,JSON.stringify(categoriesConfigFileJson.categories[5].description),categoriesConfigFileJson.categories[5].workClockTimeRef);
		})
		.then(categoriesCreated => {
			return aIexecHubInstance.m_categoriesCount.call()
		})
		.then(m_categoriesCount => console.log("m_categoriesCount is now: "+m_categoriesCount))
		;

};
*/
