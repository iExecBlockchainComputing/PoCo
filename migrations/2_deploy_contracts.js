var IexecODBLibOrders  = artifacts.require("IexecODBLibOrders");
var IexecHub           = artifacts.require("IexecHub");
var IexecClerk         = artifacts.require("IexecClerk");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var BN 				   = require("bn.js")

const fs = require("fs-extra");

module.exports = async function(deployer, network, accounts)
{
	console.log("# web3 version:", web3.version);
	chainid = await web3.eth.net.getId();
	chaintype = await web3.eth.net.getNetworkType();
	console.log("Chainid is:", chainid);
	console.log("Chaintype is:", chaintype);

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

	// await IexecHubInstance.transferOwnership(owner);
	// console.log("setCategoriesCreator to " + owner);

	// Starting deposit for all test wallets
	if (chaintype == "private")
	{
		// -------------------------------- Admin --------------------------------
		var adminAdress = "0xabcd1339Ec7e762e639f4887E2bFe5EE8023E23E";
		// var xRlcAmount  = "0x" + to18Decimals(10000000).toString(16);
		var xRlcAmount  = toWei(10000000);

		//And put directly some other xRLC in account
		await IexecClerkInstance.depositFor(adminAdress, { gas: 4500000, value: xRlcAmount });
		IexecClerkInstance.viewAccount(adminAdress).then(balance => console.log("Account.stake of " + adminAdress + " is " + balance.stake + " xRLC"));

		// ------------------------------ Scheduler ------------------------------
		var schedulerAddress = "0x000a9c787a972F70F0903890E266F41c795C4DcA";
		var xRlcAmount       = toWei(10000000);

		//For scheduler, put directly some xRLCs in account
		await IexecClerkInstance.depositFor(schedulerAddress, { gas: 4500000, value: xRlcAmount });
		await IexecClerkInstance.viewAccount(schedulerAddress).then(balance => console.log("Account.stake of " + schedulerAddress + " is " + balance.stake + " xRLC"));

		// ------------------------------- Workers -------------------------------
		var workerAddresses = fs.readFileSync(__dirname + "/accounts.txt").toString().split("\n");
		var xRlcAmount      = 1000;

		//For workers, put directly some xRLCs in account
		console.log("Making deposit to " + workerAddresses.length + " wallets");

		let batchSize = 50;
		for (var i = 0; i < workerAddresses.length; i += batchSize)
		{
			group = workerAddresses.slice(i, i+batchSize);
			await IexecClerkInstance.depositForArray(
				Array(group.length).fill(xRlcAmount),
				group,
				{ gas: 4500000, value: toWei(10000000) }
			);
			group.forEach(address => IexecClerkInstance.viewAccount(address).then(balance => console.log("Account.stake of " + address + " is " + balance.stake + " xRLC")));
		}
	}
};

function toWei(n) {
	var bn = new BN(n);
	var tenPowerNine = new BN(10).pow(new BN(9));
	return bn.mul(tenPowerNine);
}