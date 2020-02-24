const assert = require('assert')
// CONFIG
const CONFIG = require('../config/config.json')
// Token
var RLC                     = artifacts.require('rlc-faucet-contract/RLC')
// ENS
var ENSRegistry             = artifacts.require('@ensdomains/ens/ENSRegistry')
var FIFSRegistrar           = artifacts.require('@ensdomains/ens/FIFSRegistrar')
var ReverseRegistrar        = artifacts.require('@ensdomains/ens/ReverseRegistrar.sol')
var PublicResolver          = artifacts.require('@ensdomains/resolver/PublicResolver')
// Factory
var GenericFactory          = artifacts.require('@iexec/solidity/GenericFactory')
// ERC1538 core & delegates
var ERC1538Proxy            = artifacts.require('@iexec/solidity/ERC1538Proxy')
var ERC1538Update           = artifacts.require('@iexec/solidity/ERC1538UpdateDelegate')
var ERC1538Query            = artifacts.require('@iexec/solidity/ERC1538QueryDelegate')
// Libraries
var IexecLibOrders          = artifacts.require('IexecLibOrders_v4')
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
var IexecOrderManagement    = artifacts.require('IexecOrderManagementDelegate')
var IexecPoco               = artifacts.require('IexecPocoDelegate')
var IexecRelay              = artifacts.require('IexecRelayDelegate')
var ENSIntegration          = artifacts.require('ENSIntegrationDelegate')
// Other contracts
var AppRegistry             = artifacts.require('AppRegistry')
var DatasetRegistry         = artifacts.require('DatasetRegistry')
var WorkerpoolRegistry      = artifacts.require('WorkerpoolRegistry')

const LIBRARIES = [
	{ pattern: /__IexecLibOrders_v4_____________________/g, library: IexecLibOrders },
]

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
	return (abi.some(entry => entry.type == 'receive' || entry.type == 'fallback') ? 'fallback;' : '') + abi
		.filter(entry => entry.type == 'function')
		.map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`)
		.join('');
}

async function factoryDeployer(contract, options = {})
{
	console.log(`[factoryDeployer] ${contract.contractName}`);
	const factory          = await GenericFactory.deployed();
	const libraryAddresses = await Promise.all(LIBRARIES.filter(({ pattern }) => contract.bytecode.search(pattern) != -1).map(async ({ pattern, library }) => ({ pattern, ...await library.deployed()})));
	const constructorABI   = contract._json.abi.find(e => e.type == 'constructor');
	const coreCode         = libraryAddresses.reduce((code, { pattern, address }) => code.replace(pattern, address.slice(2).toLowerCase()), contract.bytecode);
	const argsCode         = constructorABI ? web3.eth.abi.encodeParameters(constructorABI.inputs.map(e => e.type), options.args).slice(2) : '';
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
		console.log(`[factory] ${contract.contractName} already deployed`);
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

	/* ------------------------- Existing deployment ------------------------- */
	const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
	const factoryOptions    = { salt: deploymentOptions.v4.salt || web3.utils.randomHex(32) };

	switch (deploymentOptions.asset)
	{
		case 'Token':
			if (deploymentOptions.token)
			{
				RLCInstance = await RLC.at(deploymentOptions.token)
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
	if (deploymentOptions.v4.usefactory)
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

	/* ---------------------------- Deploy proxy ----------------------------- */
	if (deploymentOptions.v4.usefactory)
	{
		await factoryDeployer(ERC1538Update, factoryOptions);
		await factoryDeployer(ERC1538Proxy, {
			args: [ (await ERC1538Update.deployed()).address ],
			call: web3.eth.abi.encodeFunctionCall(ERC1538Proxy._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions
		});
	}
	else
	{
		await deployer.deploy(ERC1538Update);
		await deployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address);
	}
	ERC1538 = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
	console.log(`IexecInstance deployed at address: ${ERC1538.address}`);

	/* --------------------------- Setup delegate ---------------------------- */
	contracts = [
		ERC1538Query,
		IexecAccessors,
		IexecAccessorsABILegacy,
		IexecCategoryManager,
		IexecERC20,
		deploymentOptions.asset == 'Native' ? IexecEscrowNative : IexecEscrowToken,
		IexecMaintenance,
		IexecOrderManagement,
		IexecPoco,
		IexecRelay,
		ENSIntegration,
	];

	console.log('Linking smart contracts to proxy');
	for (id in contracts)
	{
		console.log(`[${id}] ERC1538 link: ${contracts[id].contractName}`);
		if (deploymentOptions.v4.usefactory)
		{
			await factoryDeployer(contracts[id], factoryOptions);
		}
		else
		{
			await deployer.deploy(contracts[id]);
		}
		await ERC1538.updateContract(
			(await contracts[id].deployed()).address,
			getFunctionSignatures(contracts[id].abi),
			'Linking ' + contracts[id].contractName
		);
	}

	/* --------------------------- Configure Stack --------------------------- */
	switch (deploymentOptions.asset)
	{
		case 'Token':  IexecInterfaceInstance = await IexecInterfaceToken.at(ERC1538.address);  break;
		case 'Native': IexecInterfaceInstance = await IexecInterfaceNative.at(ERC1538.address); break;
	}

	if (deploymentOptions.v4.usefactory)
	{
		await factoryDeployer(AppRegistry,        {
			args: [ deploymentOptions.v3.AppRegistry || '0x0000000000000000000000000000000000000000' ],
			call: web3.eth.abi.encodeFunctionCall(AppRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions
		});
		await factoryDeployer(DatasetRegistry,    {
			args: [ deploymentOptions.v3.DatasetRegistry || '0x0000000000000000000000000000000000000000' ],
			call: web3.eth.abi.encodeFunctionCall(DatasetRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions
		});
		await factoryDeployer(WorkerpoolRegistry, {
			args: [ deploymentOptions.v3.WorkerpoolRegistry || '0x0000000000000000000000000000000000000000' ],
			call: web3.eth.abi.encodeFunctionCall(WorkerpoolRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions
		});
	}
	else
	{
		await deployer.deploy(AppRegistry,        deploymentOptions.v3.AppRegistry        || '0x0000000000000000000000000000000000000000');
		await deployer.deploy(DatasetRegistry,    deploymentOptions.v3.DatasetRegistry    || '0x0000000000000000000000000000000000000000');
		await deployer.deploy(WorkerpoolRegistry, deploymentOptions.v3.WorkerpoolRegistry || '0x0000000000000000000000000000000000000000');
	}
	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log(`AppRegistry        deployed at address: ${AppRegistryInstance.address}`);
	console.log(`DatasetRegistry    deployed at address: ${DatasetRegistryInstance.address}`);
	console.log(`WorkerpoolRegistry deployed at address: ${WorkerpoolRegistryInstance.address}`);

	await IexecInterfaceInstance.configure(
		RLCInstance.address,
		'Staked RLC',
		'SRLC',
		9, // TODO: generic ?
		AppRegistryInstance.address,
		DatasetRegistryInstance.address,
		WorkerpoolRegistryInstance.address,
		deploymentOptions.v3.Hub || '0x0000000000000000000000000000000000000000'
	);

	/* ----------------------------- Categories ------------------------------ */
	for (cat of CONFIG.categories)
	{
		console.log(`create category: ${cat.name}`);
		await IexecInterfaceInstance.createCategory(cat.name, JSON.stringify(cat.description), cat.workClockTimeRef);
	}

	var catCount = await IexecInterfaceInstance.countCategory();
	console.log(`countCategory is now: ${catCount.toNumber()}`);
	for(var i = 0; i < await IexecInterfaceInstance.countCategory(); ++i)
	{
		console.log([ 'category', i, ':', ...await IexecInterfaceInstance.viewCategory(i)].join(' '));
	}

	/* --------------------------------- ENS --------------------------------- */
	if (chaintype == 'private')
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
			return web3.utils.keccak256(web3.eth.abi.encodeParameters([ 'bytes32', 'bytes32' ], [ rootHash,  labelHash ]));
		}

		function namehash(domain)
		{
			return domain.split('.').reverse().reduce(
				(hash, label) => compose(labelhash(label), hash),
				'0x0000000000000000000000000000000000000000000000000000000000000000'
			);
		}

		async function bootstrap()
		{
			// ens registry
			await deployer.deploy(ENSRegistry);
			ens = await ENSRegistry.deployed();
			// resolver
			await deployer.deploy(PublicResolver, ens.address);
			resolver = await PublicResolver.deployed();
			// root registrar
			registrars[''] = await FIFSRegistrar.new(ens.address, '0x0', { from: accounts[0] });
			await ens.setOwner('0x0', registrars[''].address, { from: accounts[0] });

			console.log(`ENSRegistry deployed at address: ${ens.address}`);
			console.log(`PublicResolver deployed at address: ${resolver.address}`);
		}

		async function setReverseRegistrar()
		{
			await deployer.deploy(ReverseRegistrar, ens.address, resolver.address);
			reverseregistrar = await ReverseRegistrar.deployed()

			await registrars[''].register(labelhash('reverse'), accounts[0], { from: accounts[0] });
			await ens.setSubnodeOwner(namehash('reverse'), labelhash('addr'), reverseregistrar.address);
		}

		async function registerDomain(label, domain='')
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
			await resolver.setAddr(nameHash, 60, address, { from: accounts[0] });
		}

		await bootstrap();
		await setReverseRegistrar();
		await registerDomain('eth');
		await registerDomain('iexec', 'eth');

		await registerDomain('registry',   'iexec.eth');
		await registerDomain('apps',       'iexec.eth');
		await registerDomain('datasets',   'iexec.eth');
		await registerDomain('workerpool', 'iexec.eth');
		await registerDomain('users',      'iexec.eth');

		await registerAddress('admin',       'iexec.eth',          accounts[0]);
		await registerAddress('rlc',         'iexec.eth',          RLCInstance.address);
		await registerAddress('hub',         'iexec.eth',          IexecInterfaceInstance.address);
		await registerAddress('apps',        'registry.iexec.eth', AppRegistryInstance.address);
		await registerAddress('datasets',    'registry.iexec.eth', DatasetRegistryInstance.address);
		await registerAddress('workerpools', 'registry.iexec.eth', WorkerpoolRegistryInstance.address);

		await reverseregistrar.setName('admin.iexec.eth', { from: accounts[0] });
		await     IexecInterfaceInstance.setName(ens.address, 'hub.iexec.eth');
		await        AppRegistryInstance.setName(ens.address, 'apps.registry.iexec.eth');
		await    DatasetRegistryInstance.setName(ens.address, 'datasets.registry.iexec.eth');
		await WorkerpoolRegistryInstance.setName(ens.address, 'workerpools.registry.iexec.eth');
	}

	/* ------------------------ ERC1538 list methods ------------------------- */
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
};
