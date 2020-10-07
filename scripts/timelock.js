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
const CONFIG     = require('../config/config.json')

artifacts = {
	require: (name) => {
		try { return require(`${process.cwd()}/build/contracts/${name}.json`); } catch {}
		try { return require(`${process.cwd()}/node_modules/${name}.json`);    } catch {}
	}
};

const FACTORY            = require('@iexec/solidity/deployment/factory.json')
const TimelockController = artifacts.require('TimelockController')

const LIBRARIES = [
];

/*****************************************************************************
 *                                   Tools                                   *
 *****************************************************************************/
class FactoryDeployer
{
	constructor(options)
	{
		this._factory = new ethers.Contract(FACTORY.address, FACTORY.abi, options.wallet);
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

	const provider          = new ethers.getDefaultProvider(process.env.NODE);
	const wallet            = new ethers.Wallet(process.env.MNEMONIC, provider);
	const chainid           = await wallet.getChainId();
	const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;

	// Deployer
	const deployer = new FactoryDeployer({
		wallet,
		chainid,
		salt: deploymentOptions.v5.salt
	});
	await deployer.deploy(
		TimelockController,
		{
			args: [
				86400 * 7, // 7 days
				[
					"0x9ED07B5DB7dAD3C9a0baA3E320E68Ce779063249",
					"0x36e19bc6374c9cea5eb86622cf04c6b144b5b59c",
					"0x56fa2d29a54b5349cd5d88ffa584bffb2986a656",
					"0x9a78ecd77595ea305c6e5a0daed3669b17801d09",
					"0xb5ad0c32fc5fcb5e4cba4c81f523e6d47a82ecd7",
					"0xb906dc99340d0f3162dbc5b2539b0ad075649bcf",
				],
				[
					"0x0B3a38b0A47aB0c5E8b208A703de366751Df5916", // v5 deployer
				],
				[
					"0x0B3a38b0A47aB0c5E8b208A703de366751Df5916", // v5 deployer
				],
			]
		}
	);

})().catch(console.error);
