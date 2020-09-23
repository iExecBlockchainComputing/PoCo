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

const { ethers } = require('ethers');
const CONFIG     = require('../../config/config.json')

artifacts = {
	require: (name) => {
		try { return require(`${process.cwd()}/build/contracts/${name}.json`); } catch {}
		try { return require(`${process.cwd()}/node_modules/${name}.json`);    } catch {}
	}
};

const GenericFactory = artifacts.require('GenericFactory');
const ERC1538Proxy   = artifacts.require('ERC1538Proxy');
const ERC1538Update  = artifacts.require('ERC1538UpdateDelegate');

const LIBRARIES = [
	artifacts.require('IexecLibOrders_v5'),
];

const MODULES = [
	// { module: artifacts.require('IexecEscrowNativeDelegate'),    methods: null },
	{ module: artifacts.require('IexecEscrowTokenDelegate'),     methods: null },
	{ module: artifacts.require('IexecEscrowTokenSwapDelegate'), methods: null },
];

const FUNCTIONS = [
	//
];

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
	return abi
		.filter(entry => entry.type == 'function')
		.map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`)
		.join('')
	+ (abi.some(entry => entry.type == 'receive' ) ? 'receive;'  : '')
	+ (abi.some(entry => entry.type == 'fallback') ? 'fallback;' : '');
}


class FactoryDeployer
{
	constructor(artefact, options)
	{
		this._address = artefact.networks[options.chainid].address;
		this._factory = new ethers.Contract(this._address, artefact.abi, options.wallet);
		this._salt    = options.salt || ethers.utils.randomBytes(32);
	}

	async deploy(artefact, options = {})
	{
		console.log(`[factoryDeployer] ${artefact.contractName}`);
		const libraryAddresses = await Promise.all(
			LIBRARIES
			.filter(({ contractName }) => artefact.bytecode.search(contractName) != -1)
			.map(({ contractName, networks }) => ({
				pattern: new RegExp(`__${contractName}${'_'.repeat(38-contractName.length)}`, 'g'),
				address: networks[options.chainid].address,
			}))
		);

		const constructorABI   = artefact.abi.find(e => e.type == 'constructor');
		const coreCode         = libraryAddresses.reduce((code, { pattern, address }) => code.replace(pattern, address.slice(2).toLowerCase()), artefact.bytecode);
		const argsCode         = constructorABI ? ethers.utils.defaultAbiCoder.encode(constructorABI.inputs.map(e => e.type), options.args || []).slice(2) : '';
		const code             = coreCode + argsCode;
		const salt             = options.salt || this._salt || ethers.constants.HashZero;
		const predicted        = options.call
			? await this._factory.predictAddressWithCall(code, salt, options.call)
			: await this._factory.predictAddress(code, salt);

		if (await this._factory.provider.getCode(predicted) == '0x')
		{
			console.log(`[factory] Preparing to deploy ${artefact.contractName} ...`);
			options.call
				? await this._factory.createContractAndCall(code, salt, options.call)
				: await this._factory.createContract(code, salt);
			console.log(`[factory] ${artefact.contractName} successfully deployed at ${predicted}`);
		}
		else
		{
			console.log(`[factory] ${artefact.contractName} already deployed at ${predicted}`);
		}
		artefact.networks[await this._factory.signer.getChainId()] = { address: predicted };
	}
}


(async() => {

	const provider          = new ethers.providers.JsonRpcProvider(process.env.NODE);
	const wallet            = new ethers.Wallet(process.env.MNEMONIC, provider);
	const chainid           = await wallet.getChainId();
	const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;

	// Deployer
	const deployer = new FactoryDeployer(
		GenericFactory,
		{
			wallet,
			chainid,
			salt: deploymentOptions.v5.salt
		}
	);

	// Load core
	const proxy = new ethers.Contract(ERC1538Proxy.networks[chainid].address, ERC1538Update.abi, wallet);
	console.log(`Connecting to proxy at ${proxy.address}`);

	// Module updates
	for ([ i, { module, methods } ] of Object.entries(MODULES.filter(Boolean)))
	{
		console.log(`[${i}] ERC1538 link: ${module.contractName}`);
		// deploy module
		if (deploymentOptions.v5.usefactory)
		{
			await deployer.deploy(module);
		}
		else
		{
			throw 'not supported';
		}

		// update proxy
		await proxy.updateContract(
			module.networks[chainid].address,
			getFunctionSignatures(module.abi.filter(entry => !methods || methods.indexOf(entry.name) != -1)),
			`Linking module ${module.contractName}`
		);
	}

	// Function updates
	for ([ i, { func, address } ] of Object.entries(FUNCTIONS.filter(Boolean)))
	{
		// format, add ';' if needed.
		if (!func.endsWith(';')) { func += ';'; }
		// update proxy
		console.log(`[${i}] Linking function: ${func} → ${address}`);
		await proxy.updateContract(address, func, `Updating function ${func}`);
	}

})().catch(console.error);
