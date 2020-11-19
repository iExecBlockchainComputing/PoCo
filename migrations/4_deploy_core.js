/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

const assert = require('assert')
// CONFIG
const CONFIG = require('../config/config.json')
// Token
var RLC                     = artifacts.require('rlc-faucet-contract/RLC')
var ERLCSwap                = artifacts.require('@iexec/erlc/ERLCSwap')
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
var IexecERC20KYC           = artifacts.require('IexecERC20DelegateKYC')
var IexecEscrowNative       = artifacts.require('IexecEscrowNativeDelegate')
var IexecEscrowToken        = artifacts.require('IexecEscrowTokenDelegate')
var IexecEscrowTokenKYC     = artifacts.require('IexecEscrowTokenDelegateKYC')
var IexecEscrowTokenSwap    = artifacts.require('IexecEscrowTokenSwapDelegate')
var IexecMaintenance        = artifacts.require('IexecMaintenanceDelegate')
var IexecMaintenanceExtra   = artifacts.require('IexecMaintenanceExtraDelegate')
var IexecOrderManagement    = artifacts.require('IexecOrderManagementDelegate')
var IexecPoco1              = artifacts.require('IexecPoco1Delegate')
var IexecPoco1KYC           = artifacts.require('IexecPoco1DelegateKYC')
var IexecPoco2              = artifacts.require('IexecPoco2Delegate')
var IexecPoco2KYC           = artifacts.require('IexecPoco2DelegateKYC')
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

const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

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
	const salt             = options.salt || BYTES32_ZERO;

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
	const factoryOptions    = { salt: process.env.SALT || deploymentOptions.v5.salt || web3.utils.randomHex(32) };
	deploymentOptions.v5.usekyc = !!process.env.KYC;
  const proxySalt = process.env.PROXY_SALT || factoryOptions.salt; // enable deploying extra iExec Proxy instances

	/* ------------------------ Deploy & link library ------------------------ */
	if (deploymentOptions.v5.usefactory)
	{
		await factoryDeployer(IexecLibOrders); // No need for salting here
	}
	else
	{
		await deployer.deploy(IexecLibOrders);
		await deployer.link(IexecLibOrders, IexecPoco1);
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
		deploymentOptions.v5.usekyc ? IexecERC20KYC : IexecERC20,
		deploymentOptions.asset == 'Native'                                                             && IexecEscrowNative,
		deploymentOptions.asset == 'Token' &&  deploymentOptions.v5.usekyc                              && IexecEscrowTokenKYC,
		deploymentOptions.asset == 'Token' && !deploymentOptions.v5.usekyc                              && IexecEscrowToken,
		deploymentOptions.asset == 'Token' && !deploymentOptions.v5.usekyc && deploymentOptions.uniswap && IexecEscrowTokenSwap,
		IexecMaintenance,
		IexecOrderManagement,
		deploymentOptions.v5.usekyc ? IexecPoco1KYC : IexecPoco1,
		deploymentOptions.v5.usekyc ? IexecPoco2KYC : IexecPoco2,
		IexecRelay,
		ENSIntegration,
		chainid != 1 && IexecMaintenanceExtra,
	]
	.filter(Boolean);

	/* --------------------------- Deploy modules ---------------------------- */
	await Promise.all(contracts.map(module => deploymentOptions.v5.usefactory ? factoryDeployer(module) : deployer.deploy(module))); // No need for salting here

	/* ---------------------------- Deploy proxy ----------------------------- */
	if (deploymentOptions.v5.usefactory)
	{
		await factoryDeployer(ERC1538Proxy, {
			args: [ (await ERC1538Update.deployed()).address ],
			call: web3.eth.abi.encodeFunctionCall(ERC1538Proxy._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]),
			...factoryOptions,
      salt: proxySalt, // overwrite salt
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
	IexecInterfaceInstance = await IexecInterfaceToken.at(ERC1538.address);

	if (deploymentOptions.v5.usefactory)
	{
		await Promise.all([
			!AppRegistry.isDeployed()        && factoryDeployer(AppRegistry,        { call: web3.eth.abi.encodeFunctionCall(       AppRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
			!DatasetRegistry.isDeployed()    && factoryDeployer(DatasetRegistry,    { call: web3.eth.abi.encodeFunctionCall(   DatasetRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
			!WorkerpoolRegistry.isDeployed() && factoryDeployer(WorkerpoolRegistry, { call: web3.eth.abi.encodeFunctionCall(WorkerpoolRegistry._json.abi.find(e => e.name == 'transferOwnership'), [ accounts[0] ]), ...factoryOptions }),
		].filter(Boolean));
	}
	else
	{
		await Promise.all([
			!AppRegistry.isDeployed()        && deployer.deploy(AppRegistry),
			!DatasetRegistry.isDeployed()    && deployer.deploy(DatasetRegistry),
			!WorkerpoolRegistry.isDeployed() && deployer.deploy(WorkerpoolRegistry),
		].filter(Boolean));
	}

	switch (deploymentOptions.asset)
	{
		case 'Token':
			if (deploymentOptions.v5.usekyc)
			{
				TokenInstance = await ERLCSwap.deployed();
			}
			else
			{
				TokenInstance = await RLC.deployed();
			}
			break;

		case 'Native':
			TokenInstance = { address: ADDRESS_ZERO }
			break;
	}

	AppRegistryInstance        = await AppRegistry.deployed();
	DatasetRegistryInstance    = await DatasetRegistry.deployed();
	WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	console.log(`AppRegistry        deployed at address: ${AppRegistryInstance.address}`);
	console.log(`DatasetRegistry    deployed at address: ${DatasetRegistryInstance.address}`);
	console.log(`WorkerpoolRegistry deployed at address: ${WorkerpoolRegistryInstance.address}`);
	console.log(`Using token:                            ${TokenInstance.address}`);

	const AppRegistryInitialized        = await AppRegistryInstance.initialized();
	const DatasetRegistryInitialized    = await DatasetRegistryInstance.initialized();
	const WorkerpoolRegistryInitialized = await WorkerpoolRegistryInstance.initialized();
	const IexecInterfaceInitialized     = await IexecInterfaceInstance.eip712domain_separator() != BYTES32_ZERO;

	await Promise.all([
		!AppRegistryInitialized        && AppRegistryInstance.initialize(deploymentOptions.v3.AppRegistry || ADDRESS_ZERO),
		!DatasetRegistryInitialized    && DatasetRegistryInstance.initialize(deploymentOptions.v3.DatasetRegistry || ADDRESS_ZERO),
		!WorkerpoolRegistryInitialized && WorkerpoolRegistryInstance.initialize(deploymentOptions.v3.WorkerpoolRegistry || ADDRESS_ZERO),
		!AppRegistryInitialized        && AppRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/app/${chainid}/`),
		!DatasetRegistryInitialized    && DatasetRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/dataset/${chainid}/`),
		!WorkerpoolRegistryInitialized && WorkerpoolRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/workerpool/${chainid}/`),
		!IexecInterfaceInitialized     && IexecInterfaceInstance.configure(
			TokenInstance.address,
			deploymentOptions.v5.usekyc ? 'Staked ERLC'        : 'Staked RLC',
			deploymentOptions.v5.usekyc ? 'SERLC'              : 'SRLC',
			9, // TODO: generic ?
			AppRegistryInstance.address,
			DatasetRegistryInstance.address,
			WorkerpoolRegistryInstance.address,
			ADDRESS_ZERO
		),
	].filter(Boolean));

	/* ----------------------------- Categories ------------------------------ */
	await CONFIG.categories.reduce(
		async (promise, category) => {
			await promise;
			await IexecInterfaceInstance.createCategory(category.name, JSON.stringify(category.description), category.workClockTimeRef);
		},
		null
	);

	var catCount = await IexecInterfaceInstance.countCategory();

	console.log(`countCategory is now: ${catCount}`);
	(await Promise.all(
		Array(catCount.toNumber()).fill().map((_, i) => IexecInterfaceInstance.viewCategory(i))
	))
	.forEach((category, i) => console.log([ 'category', i, ':', ...category ].join(' ')));
};
