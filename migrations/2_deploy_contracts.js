// Token
var RLC                     = artifacts.require("rlc-faucet-contract/RLC");
// ENS
var ENSRegistry             = artifacts.require("@ensdomains/ens/ENSRegistry");
var FIFSRegistrar           = artifacts.require("@ensdomains/ens/FIFSRegistrar");
var ReverseRegistrar        = artifacts.require("@ensdomains/ens/ReverseRegistrar.sol");
var PublicResolver          = artifacts.require("@ensdomains/resolver/PublicResolver");
// ERC1538 core & delegates
var ERC1538Proxy            = artifacts.require("iexec-solidity/ERC1538Proxy");
var ERC1538Update           = artifacts.require("iexec-solidity/ERC1538UpdateDelegate");
var ERC1538Query            = artifacts.require("iexec-solidity/ERC1538QueryDelegate");
// Libraries
var IexecODBLibOrders       = artifacts.require("IexecODBLibOrders");
// Interface
var IexecInterface          = artifacts.require("IexecInterface");
// Delegates
var IexecAccessors          = artifacts.require("IexecAccessorsDelegate");
var IexecAccessorsABILegacy = artifacts.require("IexecAccessorsABILegacyDelegate");
var IexecCategoryManager    = artifacts.require("IexecCategoryManagerDelegate");
var IexecERC20              = artifacts.require("IexecERC20Delegate");
var IexecEscrowToken        = artifacts.require("IexecEscrowTokenDelegate");
var IexecEscrowNative       = artifacts.require("IexecEscrowNativeDelegate");
var IexecOrderSignature     = artifacts.require("IexecOrderSignatureDelegate");
var IexecPoco               = artifacts.require("IexecPocoDelegate");
var IexecRelay              = artifacts.require("IexecRelayDelegate");
var ENSReverseRegistration  = artifacts.require("ENSReverseRegistrationDelegate");
// Other contracts
var AppRegistry             = artifacts.require("AppRegistry");
var DatasetRegistry         = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry      = artifacts.require("WorkerpoolRegistry");

const USENATIVE = false;

const fs = require("fs-extra");
const BN = require('bn.js');

function getSerializedObject(entry)
{
	if (entry.type == 'tuple')
	{
		return '(' + entry.components.map(getSerializedObject).join(',') + ')'
	}
	else
	{
		return entry.type;
	}
}
function getFunctionSignatures(abi)
{
	return abi
		.filter(entry => entry.type == 'function')
		.map(entry => entry.name + '(' + entry.inputs.map(getSerializedObject).join(',') + ');')
		.join('')
}

module.exports = async function(deployer, network, accounts)
{
	console.log("# web3 version:", web3.version);
	chainid   = await web3.eth.net.getId();
	chaintype = await web3.eth.net.getNetworkType()
	console.log("Chainid is:", chainid);
	console.log("Chaintype is:", chaintype);

	switch (chaintype)
	{
		case "main":
			RLCInstance = await RLC.at("0x607F4C5BB672230e8672085532f7e901544a7375")
			owner = "0x4Bfe09055455Fe06B2fD2f59bA700783CFB3Cc53";
			break;

		case "kovan":
			RLCInstance = await RLC.at("0xc57538846ec405ea25deb00e0f9b29a432d53507")
			owner = "0xabcd1339Ec7e762e639f4887E2bFe5EE8023E23E";
			break;

		case "rinkeby":
			RLCInstance = await RLC.at("0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90")
			owner = null;
			break;

		case "ropsten":
			RLCInstance = await RLC.at("0x7314dc4d7794b5e7894212ca1556ae8e3de58621")
			owner = "0x4Bfe09055455Fe06B2fD2f59bA700783CFB3Cc53";
			break;

		case "private":
			await deployer.deploy(RLC);
			RLCInstance = await RLC.deployed();
			console.log("RLC deployed at address: " + RLCInstance.address);
			owner = await RLCInstance.owner.call()
			console.log("RLC faucet wallet is " + owner);
			supply = await RLCInstance.balanceOf(owner);
			console.log("RLC faucet supply is " + supply);

			break;

		default:
			console.log("[ERROR] Migration to chaintype " + chaintype + " is not configured");
			return 1;
			break;
	}

	/***************************************************************************
	 *                          Deploy & link library                          *
	 ***************************************************************************/
	await deployer.deploy(IexecODBLibOrders);
	await deployer.link(IexecODBLibOrders, IexecPoco);
	await deployer.link(IexecODBLibOrders, IexecOrderSignature);

	/***************************************************************************
	 *                              Deploy proxy                               *
	 ***************************************************************************/
	await deployer.deploy(ERC1538Update);
	await deployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address);
	ERC1538 = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
	console.log("IexecInstance deployed at address: " + ERC1538.address);

	/***************************************************************************
	 *                             Setup delegate                              *
	 ***************************************************************************/
	contracts = [
		ERC1538Query,
		IexecAccessors,
		IexecAccessorsABILegacy,
		IexecCategoryManager,
		IexecERC20,
		USENATIVE ? IexecEscrowNative : IexecEscrowToken,
		IexecOrderSignature,
		IexecPoco,
		IexecRelay,
		ENSReverseRegistration,
	]
	console.log("Linking smart contracts to proxy")
	for (id in contracts)
	{
		console.log("[" + id + "] ERC1538 link: " + contracts[id].contractName)
		await deployer.deploy(contracts[id]);
		await ERC1538.updateContract(
			(await contracts[id].deployed()).address,
			getFunctionSignatures(contracts[id].abi),
			"Linking " + contracts[id].contractName
		);
	}

	/***************************************************************************
	 *                             Configure Stack                             *
	 ***************************************************************************/
	IexecInterfaceInstance = await IexecInterface.at(ERC1538.address);

	await deployer.deploy(AppRegistry);
	await deployer.deploy(DatasetRegistry);
	await deployer.deploy(WorkerpoolRegistry);
	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log("AppRegistry        deployed at address: " + AppRegistryInstance.address);
	console.log("DatasetRegistry    deployed at address: " + DatasetRegistryInstance.address);
	console.log("WorkerpoolRegistry deployed at address: " + WorkerpoolRegistryInstance.address);

	await IexecInterfaceInstance.configure(
		chainid,
		RLCInstance.address,
		"Hub RLC",
		"hRLC",
		9,
		AppRegistryInstance.address,
		DatasetRegistryInstance.address,
		WorkerpoolRegistryInstance.address
	);

	var categoriesConfigFileJson = JSON.parse(fs.readFileSync("./config/categories.json"));
	for(var i = 0; i < categoriesConfigFileJson.categories.length; ++i)
	{
		console.log("create category : " + categoriesConfigFileJson.categories[i].name);
		await IexecInterfaceInstance.createCategory(
			categoriesConfigFileJson.categories[i].name
		,	JSON.stringify(categoriesConfigFileJson.categories[i].description)
		,	categoriesConfigFileJson.categories[i].workClockTimeRef
		);
	}

	var catCount = await IexecInterfaceInstance.countCategory();
	console.log("countCategory is now: " + catCount);
	for(var i = 0; i < await IexecInterfaceInstance.countCategory(); ++i)
	{
		console.log([ "category", i, ":", ...await IexecInterfaceInstance.viewCategory(i)].join(" "));
	}

	/***************************************************************************
	 *                                   ENS                                   *
	 ***************************************************************************/
	if (chaintype == "private")
	{
		var ens        = null;
		var resolver   = null;
		var registrars = {}

		function labelhash(label)
		{
			return web3.utils.keccak256(label.toLowerCase())
		}

		function compose(labelHash, rootHash)
		{
			return web3.utils.keccak256(web3.eth.abi.encodeParameters([ "bytes32", "bytes32" ], [ rootHash,  labelHash ]));
		}

		function namehash(domain)
		{
			hash = "0x0000000000000000000000000000000000000000000000000000000000000000";
			domain.split('.').reverse().forEach(label => {
				hash = compose(labelhash(label), hash);
			});
			return hash
		}

		async function bootstrap()
		{
			// ens registry
			await deployer.deploy(ENSRegistry, { from: accounts[0] });
			ens = await ENSRegistry.deployed();
			// resolver
			await deployer.deploy(PublicResolver, ens.address, { from: accounts[0] });
			resolver = await PublicResolver.deployed();
			// root registrar
			registrars[""] = await FIFSRegistrar.new(ens.address, "0x0", { from: accounts[0] });
			await ens.setOwner("0x0", registrars[""].address, { from: accounts[0] });

			console.log("ENSRegistry deployed at address: " + ens.address);
			console.log("PublicResolver deployed at address: " + resolver.address);
		}

		async function setReverseRegistrar()
		{
			await deployer.deploy(ReverseRegistrar, ens.address, resolver.address, { from: accounts[0] });
			reverseregistrar = await ReverseRegistrar.deployed()

			await registrars[""].register(labelhash("reverse"), accounts[0], { from: accounts[0] });
			await ens.setSubnodeOwner(namehash("reverse"), labelhash("addr"), reverseregistrar.address);
		}

		async function registerDomain(label, domain="")
		{
			const name      = domain ? `${label}.${domain}` : `${label}`
			const labelHash = labelhash(label);
			const nameHash  = namehash(name);
			// deploy domain registrar
			registrars[name] = await FIFSRegistrar.new(ens.address, nameHash, { from: accounts[0] });
			// register as subdomain
			await registrars[domain].register(labelHash, accounts[0], { from: accounts[0] });
			// give ownership to the new registrar
			await ens.setOwner(nameHash, registrars[name].address, { from: accounts[0] });
			return registrars[name];
		}

		async function registerAddress(label, domain, address)
		{
			const name      = `${label}.${domain}`
			const labelHash = labelhash(label);
			const nameHash  = namehash(name);
			// register as subdomain
			await registrars[domain].register(labelHash, accounts[0], { from: accounts[0] });
			// link to ens (resolver & addr)
			await ens.setResolver(nameHash, resolver.address, { from: accounts[0] });
			await resolver.setAddr(nameHash, address, { from: accounts[0] });
		}

		await bootstrap();
		await setReverseRegistrar();
		await registerDomain("eth");
		await registerDomain("iexec", "eth");
		await registerAddress("admin", "iexec.eth", accounts[0]);
		await registerAddress("token", "iexec.eth", RLCInstance.address);
		await registerAddress("hub",   "iexec.eth", IexecInterfaceInstance.address);

		await reverseregistrar.setName("admin.iexec.eth", { from: accounts[0] });
		await IexecInterfaceInstance.registerENS(ens.address, "hub.iexec.eth");
	}

	/***************************************************************************
	 *                          ERC1538 list methods                           *
	 ***************************************************************************/
	if (false)
	{
		let ERC1538QueryInstace = await ERC1538Query.at(IexecInterfaceInstance.address);
		let functionCount = await ERC1538QueryInstace.totalFunctions();

		console.log(`The deployed ERC1538Proxy supports ${functionCount} functions:`);
		for (let i = 0; i < functionCount; ++i)
		{
			let functionDetails = await ERC1538QueryInstace.functionByIndex(i);
			console.log(`[${i}] ${functionDetails.delegate} ${functionDetails.signature}`);
		}
	}

	/***************************************************************************
	 *                             Wallets deposit                             *
	 ***************************************************************************/
	// Starting deposit for all test wallets
	// if (chaintype == "private" || chaintype == "kovan")
	if (false)
	{
		// -------------------------------- Admin --------------------------------
		var adminAdress = "0xabcd1339Ec7e762e639f4887E2bFe5EE8023E23E";
		var nRlcAmount  = 10000000;

		//For admin, put some nRLC in wallet
		await RLCInstance.transfer(adminAdress, nRlcAmount, { from: owner, gas: 4500000 });
		RLCInstance.balanceOf(adminAdress).then(balance => console.log("Wallet.balance of " + adminAdress +" is " + balance + " nRLC"));

		//And put directly some other nRLCs in account
		await RLCInstance.approve(IexecInterfaceInstance.address, nRlcAmount, { from: owner });
		await IexecInterfaceInstance.depositFor(nRlcAmount, adminAdress, { from: owner, gas: 4500000 });
		IexecInterfaceInstance.viewAccount(adminAdress).then(balance => console.log("Account.Stack of " + adminAdress + " is " + balance.Stack + " nRLC"));

		// ------------------------------ Scheduler ------------------------------
		var schedulerAddress = "0x000a9c787a972F70F0903890E266F41c795C4DcA";
		var nRlcAmount       = 10000000;

		//For scheduler, put directly some nRLCs in account
		await RLCInstance.approve(IexecInterfaceInstance.address, nRlcAmount, { from: owner });
		await IexecInterfaceInstance.depositFor(nRlcAmount, schedulerAddress, { from: owner, gas: 4500000 });
		await IexecInterfaceInstance.viewAccount(schedulerAddress).then(balance => console.log("Account.Stack of " + schedulerAddress + " is " + balance.stake + " nRLC"));

		// ------------------------------- Workers -------------------------------
		var workerAddresses = fs.readFileSync(__dirname + "/accounts.txt").toString().split("\n");
		var nRlcAmount      = 1000;

		//For workers, put directly some nRLCs in account
		console.log("Making deposit to " + workerAddresses.length + " wallets");
		await RLCInstance.approve(IexecInterfaceInstance.address, workerAddresses.length * nRlcAmount, { from: owner });

		let batchSize = 30;
		for (var i = 0; i < workerAddresses.length; i += batchSize)
		{
			group = workerAddresses.slice(i, i+batchSize);
			await IexecInterfaceInstance.depositForArray(
				Array(group.length).fill(nRlcAmount),
				group,
				{ from: owner, gas: 4500000 }
			);
			group.forEach(address => IexecInterfaceInstance.viewAccount(address).then(balance => console.log("Account.Stack of " + address + " is " + balance.stake + " nRLC")));
		}
	}

};
