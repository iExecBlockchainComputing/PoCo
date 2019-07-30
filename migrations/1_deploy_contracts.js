var IexecODBLibOrders  = artifacts.require("IexecODBLibOrders");
var IexecHub           = artifacts.require("IexecHub");
var IexecClerk         = artifacts.require("IexecClerk");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");

const fs = require("fs-extra");

module.exports = async function(deployer, network, accounts)
{
	console.log("# web3 version:", web3.version);
	chainid = await web3.eth.net.getId();
	console.log("Chainid is:", chainid);

	await deployer.deploy(IexecODBLibOrders);
	await deployer.link(IexecODBLibOrders, IexecClerk);

	await deployer.deploy(IexecHub);
	IexecHubInstance = await IexecHub.deployed();
	console.log("IexecHub deployed at address: " + IexecHubInstance.address);

	await deployer.deploy(IexecClerk, IexecHubInstance.address, chainid);
	IexecClerkInstance = await IexecClerk.deployed();
	console.log("IexecClerk deployed at address: " + IexecClerkInstance.address);

	await deployer.deploy(AppRegistry);
	await deployer.deploy(DatasetRegistry);
	await deployer.deploy(WorkerpoolRegistry);
	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log("AppRegistry        deployed at address: " + AppRegistryInstance.address);
	console.log("DatasetRegistry    deployed at address: " + DatasetRegistryInstance.address);
	console.log("WorkerpoolRegistry deployed at address: " + WorkerpoolRegistryInstance.address);

	await IexecHubInstance.attachContracts(
		IexecClerkInstance.address
	, AppRegistryInstance.address
	, DatasetRegistryInstance.address
	, WorkerpoolRegistryInstance.address
	);
	console.log("attach Contracts to IexecHub done");

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

	var catCount = await IexecHubInstance.countCategory();
	console.log("countCategory is now: " + catCount);
	for(var i = 0; i < await IexecHubInstance.countCategory(); ++i)
	{
		console.log([ "category", i, ":", ...await IexecHubInstance.viewCategory(i)].join(" "));
	}
};
