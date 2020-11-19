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
const FACTORY    = require('@iexec/solidity/deployment/factory.json')

module.exports = class FactoryDeployer
{
	constructor(provider, salt = null)
	{
		this._factory = new ethers.Contract(FACTORY.address, FACTORY.abi, provider);
		this._salt    = salt;
	}

	async deploy(artefact, options = {})
	{
		const chainid = await this._factory.signer.getChainId();

		console.log(`[factoryDeployer] ${artefact.contractName}`);
		const libraryAddresses = await Promise.all(
			(options.libraries || [])
			.filter(({ contractName }) => artefact.bytecode.search(contractName) != -1)
			.map(({ contractName, networks }) => ({
				pattern: new RegExp(`__${contractName}${'_'.repeat(38-contractName.length)}`, 'g'),
				address: networks[chainid].address,
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
		artefact.networks[chainid] = { address: predicted };
	}
}
