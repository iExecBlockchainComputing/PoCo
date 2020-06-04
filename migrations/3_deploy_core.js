const assert = require('assert')
// CONFIG
const CONFIG = require('../config/config.json')
// Token
var RLC                     = artifacts.require('rlc-faucet-contract/RLC')
// Factory
var GenericFactory          = artifacts.require('@iexec/solidity/GenericFactory')
// ERC1538 core & delegates
var ERC1538Proxy            = artifacts.require('@iexec/solidity/ERC1538Proxy')
var ERC1538Update           = artifacts.require('@iexec/solidity/ERC1538UpdateDelegate')
var ERC1538Query            = artifacts.require('@iexec/solidity/ERC1538QueryDelegate')
// Libraries
var IexecLibOrders          = artifacts.require('IexecLibOrders_v5')
// Interface
var IexecInterfaceNative    = artifacts.require('IexecInterfaceNative')
var IexecInterfaceToken     = artifacts.require('IexecInterfaceToken')
// Delegates
var IexecAccessors          = artifacts.require('IexecAccessorsDelegate')
var IexecAccessorsABILegacy = artifacts.require('IexecAccessorsABILegacyDelegate')
var IexecCategoryManager    = artifacts.require('IexecCategoryManagerDelegate')
var IexecERC20              = artifacts.require('IexecERC20Delegate')
var IexecEscrowToken        = artifacts.require('IexecEscrowTokenDelegate')
var IexecEscrowNative       = artifacts.require('IexecEscrowNativeDelegate')
var IexecMaintenance        = artifacts.require('IexecMaintenanceDelegate')
var IexecMaintenanceExtra   = artifacts.require('IexecMaintenanceExtraDelegate')
var IexecOrderManagement    = artifacts.require('IexecOrderManagementDelegate')
var IexecPoco               = artifacts.require('IexecPocoDelegate')
var IexecRelay              = artifacts.require('IexecRelayDelegate')
var ENSIntegration          = artifacts.require('ENSIntegrationDelegate')
// Other contracts
var AppRegistry             = artifacts.require('AppRegistry')
var DatasetRegistry         = artifacts.require('DatasetRegistry')
var WorkerpoolRegistry      = artifacts.require('WorkerpoolRegistry')

const LIBRARIES = [
	IexecLibOrders,
].map(contract => ({
	pattern: new RegExp(`__${contract.contractName}${'_'.repeat(38-contract.contractName.length)}`, 'g'),
	library: contract,
}))

/*****************************************************************************
 *                                   Tools                                   *
 *****************************************************************************/
function getSerializedObject(entry)
{
	return (entry.type == 'tuple')
		? `(${entry.components.map(getSerializedObject).join(',')})`
		: entry.type;
}

function getFunctionSignatures(abi)
{
	return [
		...abi
			.filter(entry => entry.type == 'receive')
			.map(entry => 'receive;'),
		...abi
			.filter(entry => entry.type == 'fallback')
			.map(entry => 'fallback;'),
		...abi
			.filter(entry => entry.type == 'function')
			.map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`),
	].filter(Boolean).join('');
}

async function factoryDeployer(contract, options = {})
{
	console.log(`[factoryDeployer] ${contract.contractName}`);
	const factory          = await GenericFactory.deployed();
	const libraryAddresses = await Promise.all(LIBRARIES.filter(({ pattern }) => contract.bytecode.search(pattern) != -1).map(async ({ pattern, library }) => ({ pattern, ...await library.deployed() })));
	const constructorABI   = contract._json.abi.find(e => e.type == 'constructor');
	const coreCode         = libraryAddresses.reduce((code, { pattern, address }) => code.replace(pattern, address.slice(2).toLowerCase()), contract.bytecode);
	const argsCode         = constructorABI ? web3.eth.abi.encodeParameters(constructorABI.inputs.map(e => e.type), options.args || []).slice(2) : '';
	const code             = coreCode + argsCode;
	const salt             = options.salt  || '0x0000000000000000000000000000000000000000000000000000000000000000';

	contract.address = options.call
		? await factory.predictAddressWithCall(code, salt, options.call)
		: await factory.predictAddress(code, salt);

	if (await web3.eth.getCode(contract.address) == '0x')
	{
		console.log(`[factory] Preparing to deploy ${contract.contractName} ...`);
		options.call
			? await factory.createContractAndCall(code, salt, options.call)
			: await factory.createContract(code, salt);
		console.log(`[factory] ${contract.contractName} successfully deployed at ${contract.address}`);
	}
	else
	{
		console.log(`[factory] ${contract.contractName} already deployed at ${contract.address}`);
	}
}

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function(deployer, network, accounts)
{
	console.log('# web3 version:', web3.version);
	const chainid   = await web3.eth.net.getId();
	const chaintype = await web3.eth.net.getNetworkType();
	console.log('Chainid is:', chainid);
	console.log('Chaintype is:', chaintype);
	console.log('Deployer is:', accounts[0]);

	/* ------------------------- Existing deployment ------------------------- */
	const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
	const factoryOptions    = { salt: deploymentOptions.v5.salt || process.env.SALT || web3.utils.randomHex(32) };

	switch (deploymentOptions.asset)
	{
		case 'Token':
			if (deploymentOptions.token)
			{
				RLCInstance = await RLC.at(deploymentOptions.token);
			}
			else
			{
				await deployer.deploy(RLC);
				RLCInstance = await RLC.deployed();
			}
			break;

		case 'Native':
			RLCInstance = { address: '0x0000000000000000000000000000000000000000' };
			break;
	}

	/* ------------------------ Deploy & link library ------------------------ */
	if (deploymentOptions.v5.usefactory)
	{
		await factoryDeployer(IexecLibOrders, factoryOptions);
	}
	else
	{
		await deployer.deploy(IexecLibOrders);
		await deployer.link(IexecLibOrders, IexecPoco);
		await deployer.link(IexecLibOrders, IexecMaintenance);
		await deployer.link(IexecLibOrders, IexecOrderManagement);
	}

	/* ---------------------------- Modules list ----------------------------- */
	contracts = [
		ERC1538Update,
		ERC1538Query,
		IexecAccessors,
		IexecAccessorsABILegacy,
		IexecCategoryManager,
		IexecERC20,
		deploymentOptions.asset == 'Native' && IexecEscrowNative,
		deploymentOptions.asset == 'Token'  && IexecEscrowToken,
		IexecMaintenance,
		IexecOrderManagement,
		IexecPoco,
		IexecRelay,
		ENSIntegration,
		chainid != 1 && IexecMaintenanceExtra,
	]
	.filter(Boolean);

	/* --------------------------- Deploy modules ---------------------------- */
	await Promise.all(contracts.map(module => deploymentOptions.v5.usefactory ? factoryDeployer(module, factoryOptions) : deployer.deploy(module)));

	/* ---------------------------- Deploy proxy ----------------------------- */
	if (deploymentOptions.v5.usefactory)
	{
		await factoryDeployer(ERC1538Proxy, {
			args: [ (await ERC1538Update.deployed()).address ],
			call: web3.eth.abi.encodeFunctionCall(ERC1538Proxy._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions
		});
	}
	else
	{
		await deployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address);
	}
	ERC1538 = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
	console.log(`IexecInstance deployed at address: ${ERC1538.address}`);

	/* --------------------------- Setup modules ---------------------------- */
	await Promise.all(contracts.filter(module => module != ERC1538Update).map(async module => {
		console.log(`ERC1538 link: ${module.contractName}`);
		return ERC1538.updateContract(
			(await module.deployed()).address,
			getFunctionSignatures(module.abi),
			'Linking ' + module.contractName
		);
	}));

	/* --------------------------- Configure Stack --------------------------- */
	switch (deploymentOptions.asset)
	{
		case 'Token':  IexecInterfaceInstance = await IexecInterfaceToken.at(ERC1538.address);  break;
		case 'Native': IexecInterfaceInstance = await IexecInterfaceNative.at(ERC1538.address); break;
	}

	if (deploymentOptions.v5.usefactory)
	{
		await Promise.all([
			factoryDeployer(AppRegistry,        { call: web3.eth.abi.encodeFunctionCall(       AppRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
			factoryDeployer(DatasetRegistry,    { call: web3.eth.abi.encodeFunctionCall(   DatasetRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
			factoryDeployer(WorkerpoolRegistry, { call: web3.eth.abi.encodeFunctionCall(WorkerpoolRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
		]);
	}
	else
	{
		await Promise.all([
			deployer.deploy(AppRegistry),
			deployer.deploy(DatasetRegistry),
			deployer.deploy(WorkerpoolRegistry),
		]);
	}

	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log(`AppRegistry        deployed at address: ${AppRegistryInstance.address}`);
	console.log(`DatasetRegistry    deployed at address: ${DatasetRegistryInstance.address}`);
	console.log(`WorkerpoolRegistry deployed at address: ${WorkerpoolRegistryInstance.address}`);

	await Promise.all([
		AppRegistryInstance.initialize(deploymentOptions.v3.AppRegistry || '0x0000000000000000000000000000000000000000'),
		DatasetRegistryInstance.initialize(deploymentOptions.v3.DatasetRegistry || '0x0000000000000000000000000000000000000000'),
		WorkerpoolRegistryInstance.initialize(deploymentOptions.v3.WorkerpoolRegistry || '0x0000000000000000000000000000000000000000'),
		AppRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/app/${chainid}/`),
		DatasetRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/dataset/${chainid}/`),
		WorkerpoolRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/workerpool/${chainid}/`),
		IexecInterfaceInstance.configure(
			RLCInstance.address,
			'Staked RLC',
			'SRLC',
			9, // TODO: generic ?
			AppRegistryInstance.address,
			DatasetRegistryInstance.address,
			WorkerpoolRegistryInstance.address,
			deploymentOptions.v3.Hub || '0x0000000000000000000000000000000000000000'
		),
	]);

	/* ----------------------------- Categories ------------------------------ */
	await Promise.all(CONFIG.categories.map(category => {
		console.log(`create category: ${category.name}`);
		return IexecInterfaceInstance.createCategory(category.name, JSON.stringify(category.description), category.workClockTimeRef);
	}));

	var catCount = await IexecInterfaceInstance.countCategory();

	console.log(`countCategory is now: ${catCount}`);
	(await Promise.all(
		Array(catCount.toNumber()).fill().map((_, i) => IexecInterfaceInstance.viewCategory(i))
	))
	.forEach((category, i) => console.log([ 'category', i, ':', ...category ].join(' ')));
};
