const assert = require('assert')
// CONFIG
const DEPLOYMENT = require('../config/deployment.json')
// Token
var RLC                     = artifacts.require('rlc-faucet-contract/RLC')
// ENS
var ENSRegistry             = artifacts.require('@ensdomains/ens/ENSRegistry')
var FIFSRegistrar           = artifacts.require('@ensdomains/ens/FIFSRegistrar')
var ReverseRegistrar        = artifacts.require('@ensdomains/ens/ReverseRegistrar.sol')
var PublicResolver          = artifacts.require('@ensdomains/resolver/PublicResolver')
// ERC1538 core & delegates
var ERC1538Proxy            = artifacts.require('iexec-solidity/ERC1538Proxy')
var ERC1538Update           = artifacts.require('iexec-solidity/ERC1538UpdateDelegate')
var ERC1538Query            = artifacts.require('iexec-solidity/ERC1538QueryDelegate')
// Libraries
var IexecODBLibOrders       = artifacts.require('IexecODBLibOrders_v4')
// Interface
var IexecInterface          = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`)
// Delegates
var IexecAccessors          = artifacts.require('IexecAccessorsDelegate')
var IexecAccessorsABILegacy = artifacts.require('IexecAccessorsABILegacyDelegate')
var IexecCategoryManager    = artifacts.require('IexecCategoryManagerDelegate')
var IexecERC20              = artifacts.require('IexecERC20Delegate')
var IexecEscrowToken        = artifacts.require('IexecEscrowTokenDelegate')
var IexecEscrowNative       = artifacts.require('IexecEscrowNativeDelegate')
var IexecMaintenance        = artifacts.require('IexecMaintenanceDelegate')
var IexecOrderSignature     = artifacts.require('IexecOrderSignatureDelegate')
var IexecPoco               = artifacts.require('IexecPocoDelegate')
var IexecRelay              = artifacts.require('IexecRelayDelegate')
var ENSIntegration          = artifacts.require('ENSIntegrationDelegate')
// Other contracts
var AppRegistry             = artifacts.require('AppRegistry')
var DatasetRegistry         = artifacts.require('DatasetRegistry')
var WorkerpoolRegistry      = artifacts.require('WorkerpoolRegistry')
var GenericFactory          = artifacts.require('GenericFactory')

DEPLOYMENT.salt = DEPLOYMENT.salt || web3.utils.randomHex(32);

const LIBRARIES = [
	{ pattern: /__IexecODBLibOrders_v4__________________/g, library: IexecODBLibOrders },
]

function getSerializedObject(entry)
{
	if (entry.type == 'tuple')
	{
		return '(' + entry.components.map(getSerializedObject).join(',') + ')';
	}
	else
	{
		return entry.type;
	}
}

function getFunctionSignatures(abi)
{
	return (abi.some(entry => entry.type == 'fallback') ? 'fallback;' : '') + abi
		.filter(entry => entry.type == 'function')
		.map(entry => entry.name + '(' + entry.inputs.map(getSerializedObject).join(',') + ');')
		.join('');
}

async function factoryDeployer(contract, options = {})
{
	console.log(`[factoryDeployer] ${contract.contractName}`);
	let factory        = await GenericFactory.deployed();
	let constructorABI = contract._json.abi.find(e => e.type == 'constructor');
	let coreCode       = contract.bytecode;

	for ({ pattern, library } of LIBRARIES)
	{
		if (coreCode.search(pattern) != -1)
		{
			let { address } = await library.deployed()
			coreCode = coreCode.replace(pattern, address.slice(2).toLowerCase())
		}
	}

	let argsCode       = constructorABI ? web3.eth.abi.encodeParameters(contract._json.abi.filter(e => e.type == 'constructor')[0].inputs.map(e => e.type), options.args).slice(2) : ''
	let deployCode     = coreCode + argsCode

	contract.address = await factory.predictAddress(deployCode, options.salt || '0x0000000000000000000000000000000000000000000000000000000000000000');

	if (await web3.eth.getCode(contract.address) == '0x')
	{
		console.log(`[factory] Preparing to deploy ${contract.contractName} ...`);
		if (options.call)
		{
			await factory.createContractAndCallback(deployCode, options.salt || '0x0000000000000000000000000000000000000000000000000000000000000000', options.call);
		}
		else
		{
			await factory.createContract(deployCode, options.salt || '0x0000000000000000000000000000000000000000000000000000000000000000');
		}
		console.log(`[factory] ${contract.contractName} successfully deployed`);
	}
	else
	{
		console.log(`[factory] ${contract.contractName} already deployed`);
	}
}

module.exports = async function(deployer, network, accounts)
{
	console.log('# web3 version:', web3.version);
	chainid   = await web3.eth.net.getId();
	chaintype = await web3.eth.net.getNetworkType();
	console.log('Chainid is:', chainid);
	console.log('Chaintype is:', chaintype);

	if (DEPLOYMENT.asset !== 'Native')
	{
		switch (chaintype)
		{
			case 'main':
				RLCInstance = await RLC.at('0x607F4C5BB672230e8672085532f7e901544a7375');
				owner = '0x4Bfe09055455Fe06B2fD2f59bA700783CFB3Cc53';
				break;

			case 'kovan':
				RLCInstance = await RLC.at('0xc57538846ec405ea25deb00e0f9b29a432d53507');
				owner = '0xabcd1339Ec7e762e639f4887E2bFe5EE8023E23E';
				break;

			case 'rinkeby':
				RLCInstance = await RLC.at('0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90');
				owner = null;
				break;

			case 'ropsten':
				RLCInstance = await RLC.at('0x7314dc4d7794b5e7894212ca1556ae8e3de58621');
				owner = '0x4Bfe09055455Fe06B2fD2f59bA700783CFB3Cc53';
				break;

			case 'private':
				await deployer.deploy(RLC);
				RLCInstance = await RLC.deployed();
				console.log(`RLC deployed at address: ${RLCInstance.address}`);
				owner = await RLCInstance.owner.call()
				console.log(`RLC faucet wallet is ${owner}`);
				supply = await RLCInstance.balanceOf(owner);
				console.log(`RLC faucet supply is ${supply}`);
				break;

			default:
				console.log(`[ERROR] RLC not configured for chaintype ${chaintype}`);
				return 1;
				break;
		}
	}
	else
	{
		RLCInstance = { address: '0x0000000000000000000000000000000000000000' };
	}

	/***************************************************************************
	 *                          Deploy & link library                          *
	 ***************************************************************************/
	if (DEPLOYMENT.usefactory)
	{
		await factoryDeployer(IexecODBLibOrders, {
			salt: DEPLOYMENT.salt
		});
	}
	else
	{
		await deployer.deploy(IexecODBLibOrders);
		await deployer.link(IexecODBLibOrders, IexecPoco);
		await deployer.link(IexecODBLibOrders, IexecMaintenance);
		await deployer.link(IexecODBLibOrders, IexecOrderSignature);
	}

	/***************************************************************************
	 *                              Deploy proxy                               *
	 ***************************************************************************/
	if (DEPLOYMENT.usefactory)
	{
		await factoryDeployer(ERC1538Update, {
			salt: DEPLOYMENT.salt
		});
		await factoryDeployer(ERC1538Proxy, {
			args: [ (await ERC1538Update.deployed()).address ],
			salt: DEPLOYMENT.salt,
			call: web3.eth.abi.encodeFunctionCall(ERC1538Proxy._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ])
		});
	}
	else
	{
		await deployer.deploy(ERC1538Update);
		await deployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address);
	}
	ERC1538 = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
	console.log(`IexecInstance deployed at address: ${ERC1538.address}`);

	/***************************************************************************
	 *                             Setup delegate                              *
	 ***************************************************************************/
	contracts = [
		ERC1538Query,
		IexecAccessors,
		IexecAccessorsABILegacy,
		IexecCategoryManager,
		IexecERC20,
		DEPLOYMENT.asset == 'Native' ? IexecEscrowNative : IexecEscrowToken,
		IexecMaintenance,
		IexecOrderSignature,
		IexecPoco,
		IexecRelay,
		ENSIntegration,
	];

	console.log('Linking smart contracts to proxy');
	for (id in contracts)
	{
		console.log(`[${id}] ERC1538 link: ${contracts[id].contractName}`);
		if (DEPLOYMENT.usefactory)
		{
			await factoryDeployer(contracts[id], {
				salt: DEPLOYMENT.salt
			});
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

	/***************************************************************************
	 *                             Configure Stack                             *
	 ***************************************************************************/
	IexecInterfaceInstance = await IexecInterface.at(ERC1538.address);

	if (DEPLOYMENT.usefactory)
	{
		await factoryDeployer(AppRegistry,        {
			args: [ '0x0000000000000000000000000000000000000000' ],
			salt: DEPLOYMENT.salt,
			call: web3.eth.abi.encodeFunctionCall(AppRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ])
		});
		await factoryDeployer(DatasetRegistry,    {
			args: [ '0x0000000000000000000000000000000000000000' ],
			salt: DEPLOYMENT.salt,
			call: web3.eth.abi.encodeFunctionCall(DatasetRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ])
		});
		await factoryDeployer(WorkerpoolRegistry, {
			args: [ '0x0000000000000000000000000000000000000000' ],
			salt: DEPLOYMENT.salt,
			call: web3.eth.abi.encodeFunctionCall(WorkerpoolRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ])
		});
	}
	else
	{
		await deployer.deploy(AppRegistry,        '0x0000000000000000000000000000000000000000'); // TODO
		await deployer.deploy(DatasetRegistry,    '0x0000000000000000000000000000000000000000'); // TODO
		await deployer.deploy(WorkerpoolRegistry, '0x0000000000000000000000000000000000000000'); // TODO
	}
	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log('AppRegistry        deployed at address: ' + AppRegistryInstance.address);
	console.log('DatasetRegistry    deployed at address: ' + DatasetRegistryInstance.address);
	console.log('WorkerpoolRegistry deployed at address: ' + WorkerpoolRegistryInstance.address);

	await IexecInterfaceInstance.configure(
		chainid,
		RLCInstance.address,
		'Hub RLC',
		'hRLC',
		9,
		AppRegistryInstance.address,
		DatasetRegistryInstance.address,
		WorkerpoolRegistryInstance.address,
		'0x0000000000000000000000000000000000000000' // TODO
	);

	for (cat of DEPLOYMENT.categories)
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

	/***************************************************************************
	 *                                   ENS                                   *
	 ***************************************************************************/
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
		await     IexecInterfaceInstance.ENSReverseRegister(ens.address, 'hub.iexec.eth');
		await        AppRegistryInstance.ENSReverseRegister(ens.address, 'apps.registry.iexec.eth');
		await    DatasetRegistryInstance.ENSReverseRegister(ens.address, 'datasets.registry.iexec.eth');
		await WorkerpoolRegistryInstance.ENSReverseRegister(ens.address, 'workerpools.registry.iexec.eth');
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
	// if (chaintype == 'private' || chaintype == 'kovan')
	if (false)
	{
		// -------------------------------- Admin --------------------------------
		var adminAdress = '0xabcd1339Ec7e762e639f4887E2bFe5EE8023E23E';
		var nRlcAmount  = 10000000;

		//For admin, put some nRLC in wallet
		await RLCInstance.transfer(adminAdress, nRlcAmount, { from: owner, gas: 4500000 });
		RLCInstance.balanceOf(adminAdress).then(balance => console.log('Wallet.balance of ' + adminAdress +' is ' + balance + ' nRLC'));

		//And put directly some other nRLCs in account
		await RLCInstance.approve(IexecInterfaceInstance.address, nRlcAmount, { from: owner });
		await IexecInterfaceInstance.depositFor(nRlcAmount, adminAdress, { from: owner, gas: 4500000 });
		IexecInterfaceInstance.viewAccount(adminAdress).then(balance => console.log('Account.Stack of ' + adminAdress + ' is ' + balance.Stack + ' nRLC'));

		// ------------------------------ Scheduler ------------------------------
		var schedulerAddress = '0x000a9c787a972F70F0903890E266F41c795C4DcA';
		var nRlcAmount       = 10000000;

		//For scheduler, put directly some nRLCs in account
		await RLCInstance.approve(IexecInterfaceInstance.address, nRlcAmount, { from: owner });
		await IexecInterfaceInstance.depositFor(nRlcAmount, schedulerAddress, { from: owner, gas: 4500000 });
		await IexecInterfaceInstance.viewAccount(schedulerAddress).then(balance => console.log('Account.Stack of ' + schedulerAddress + ' is ' + balance.stake + ' nRLC'));

		// ------------------------------- Workers -------------------------------
		var workerAddresses = fs.readFileSync(__dirname + '/accounts.txt').toString().split('\n');
		var nRlcAmount      = 1000;

		//For workers, put directly some nRLCs in account
		console.log('Making deposit to ' + workerAddresses.length + ' wallets');
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
			group.forEach(address => IexecInterfaceInstance.viewAccount(address).then(balance => console.log('Account.Stack of ' + address + ' is ' + balance.stake + ' nRLC')));
		}
	}
};
