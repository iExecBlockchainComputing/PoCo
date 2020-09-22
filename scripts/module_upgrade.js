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

const assert       = require('assert')
const CONFIG       = require('../config/config.json')
var GenericFactory = artifacts.require('@iexec/solidity/GenericFactory')
var ERC1538Proxy   = artifacts.require('@iexec/solidity/ERC1538Proxy')
var ERC1538Update  = artifacts.require('@iexec/solidity/ERC1538UpdateDelegate')

/*****************************************************************************
 *                               Configuration                               *
 *****************************************************************************/
const LIBRARIES = [
	// artifacts.require('IexecLibOrders_v5'),
]

const MODULES = [
	// { module: artifacts.require('IexecAccessorsDelegate'),       methods: [ 'viewTask', 'resultFor'             ] }, // result separation update
	// { module: artifacts.require('IexecPocoDelegate'),            methods: [ 'finalize', 'contributeAndFinalize' ] }, // result separation update
	// { module: artifacts.require('IexecEscrowTokenDelegate'),     methods: null                                    }, // escrow upgrade (uniswap)
	// { module: artifacts.require('IexecEscrowTokenSwapDelegate'), methods: null                                    }, // escrow upgrade (uniswap)
]

const FUNCTIONS = [
	// { func: 'finalize(bytes32,bytes);',                                          address: '0x0000000000000000000000000000000000000000' }, // result separation update
	// { func: 'contributeAndFinalize(bytes32,bytes32,bytes,address,bytes,bytes);', address: '0x0000000000000000000000000000000000000000' }, // result separation update
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
	return abi
		.filter(entry => entry.type == 'function')
		.map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`)
		.join('')
	+ (abi.some(entry => entry.type == 'receive' ) ? 'receive;'  : '')
	+ (abi.some(entry => entry.type == 'fallback') ? 'fallback;' : '');
}

async function factoryDeployer(contract, options = {})
{
	console.log(`[factoryDeployer] ${contract.contractName}`);
	const factory          = await GenericFactory.deployed();
	const libraryAddresses = await Promise.all(
		LIBRARIES
		.filter(({ contractName }) => contract.bytecode.search(contractName) != -1)
		.map(async ({ contractName, deployed }) => ({
			pattern: new RegExp(`__${contractName}${'_'.repeat(38-contractName.length)}`, 'g'),
			...await deployed()
		}))
	);

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
		console.log(`[factory] ${contract.contractName} already deployed`);
	}
}
/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async (callback) => {
	try
	{
		console.log('# web3 version:', web3.version);
		const chainid   = await web3.eth.net.getId();
		const chaintype = await web3.eth.net.getNetworkType();
		console.log('Chainid is:', chainid);
		console.log('Chaintype is:', chaintype);

		// Load config
		const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
		const factoryOptions    = { salt: deploymentOptions.v5.salt || web3.utils.randomHex(32) };

		// Load core
		const proxy = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
		console.log('Deploying to proxy:', proxy.address);

		// Module updates
		for ([ i, { module, methods } ] of Object.entries(MODULES.filter(Boolean)))
		{
			console.log(`[${i}] ERC1538 link: ${module.contractName}`);
			// deploy module
			if (deploymentOptions.v5.usefactory)
			{
				await factoryDeployer(module, factoryOptions);
			}
			else
			{
				await deployer.deploy(module);
			}
			// update proxy
			await proxy.updateContract(
				(await module.deployed()).address,
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
	}
	catch (e)
	{
		callback(e)
	}
	finally
	{
		callback()
	}
}
