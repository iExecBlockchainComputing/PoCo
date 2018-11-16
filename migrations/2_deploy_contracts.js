var RLC               = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecODBLibOrders = artifacts.require("./IexecODBLibOrders.sol");
var IexecHub          = artifacts.require("./IexecHub.sol");
var IexecClerk        = artifacts.require("./IexecClerk.sol");
var DappRegistry      = artifacts.require("./DappRegistry.sol");
var DataRegistry      = artifacts.require("./DataRegistry.sol");
var PoolRegistry      = artifacts.require("./PoolRegistry.sol");
var Relay             = artifacts.require("./Relay.sol");
var Broker            = artifacts.require("./Broker.sol");

const fs = require("fs-extra");

module.exports = async function(deployer, network, accounts)
{
	console.log("# web3 version:", web3.version);
	chainid   = await web3.eth.net.getId();
	chaintype = await web3.eth.net.getNetworkType()
	console.log("Chainid is:", chainid);
	console.log("Chaintype is:", chaintype);

	switch (chaintype)
	{
		case "kovan":
			RLCInstance = await RLC.at("0xc57538846ec405ea25deb00e0f9b29a432d53507")
			owner = null;
			break;

		case "rinkeby":
			RLCInstance = await RLC.at("0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90")
			owner = null;
			break;

		case "ropsten":
			RLCInstance = await RLC.at("0x7314dc4d7794b5e7894212ca1556ae8e3de58621")
			owner = null;
			break;

		case "mainnet":
			RLCInstance = await RLC.at("0x607F4C5BB672230e8672085532f7e901544a7375")
			owner = null;
			break;

		case "private":
			await deployer.deploy(RLC);
			RLCInstance = await RLC.deployed();
			console.log("RLC deployed at address: " + RLCInstance.address);
			owner = await RLCInstance.owner.call()
			console.log("RLC faucet wallet is " + owner);
			console.log("RLC faucet supply is " + await RLCInstance.balanceOf(owner));
			break;

		default:
			console.log("[ERROR] Migration to chaintype " + chaintype + " is not configured");
			return 1;
			break;
	}

	await deployer.deploy(IexecODBLibOrders);
	await deployer.link(IexecODBLibOrders, IexecClerk);

	await deployer.deploy(IexecHub);
	IexecHubInstance = await IexecHub.deployed();
	console.log("IexecHub deployed at address: " + IexecHubInstance.address);

	await deployer.deploy(IexecClerk, RLCInstance.address, IexecHubInstance.address, chainid);
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

	await IexecHubInstance.transferOwnership(owner);
	console.log("setCategoriesCreator to " + owner);

	// experimental, do not deploy
	if (chaintype == "private")
	{
		await deployer.deploy(Relay);
		await deployer.deploy(Broker, IexecClerkInstance.address);
		RelayInstance  = await Relay.deployed();
		BrokerInstance = await Broker.deployed();
		console.log("Relay deployed at address: " + RelayInstance.address);
		console.log("Broker deployed at address: " + BrokerInstance.address);
	}

};
