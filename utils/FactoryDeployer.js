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

async function waitTx(txPromise) { await (await txPromise).wait() }

class EthersDeployer
{
	// factory: ethers.Contract
	// factoryAsPromise: Promise<ethers.Contract>

	constructor(wallet, options = {})
	{
		this.options = options;
		this.factoryAsPromise = new Promise(async (resolve, reject) => {
			if (await wallet.provider.getCode(FACTORY.address) !== "0x")
			{
				console.debug(`→ Factory is available on this network`);
			}
			else
			{
				try
				{
					console.debug(`→ Factory is not yet deployed on this network`);
					await waitTx(wallet.sendTransaction({ to: FACTORY.deployer, value: FACTORY.cost }));
					await waitTx(wallet.provider.sendTransaction(FACTORY.tx));
					console.debug(`→ Factory successfully deployed`);
				}
				catch (e)
				{
					console.debug(`→ Error deploying the factory`);
					reject(e);
				}
			}
			this.factory = new ethers.Contract(FACTORY.address, FACTORY.abi, wallet);
			resolve(this.factory);
		})
	}

	async ready()
	{
		await this.factoryAsPromise;
	}

	async deploy(artefact, ...extra)
	{
		await this.ready();
		console.log(`[factoryDeployer] ${artefact.contractName}`);
		const constructorABI   = artefact.abi.find(e => e.type == 'constructor');
		const argsCount        = constructorABI ? constructorABI.inputs.length : 0;
		const args             = extra.slice(0, argsCount);
		const options          = { ...this.options, ...extra[argsCount] };
		var librariesLinkPlaceHolderAndAddress = []
		if (options.libraries) {
			librariesLinkPlaceHolderAndAddress = await Promise.all(
				options.libraries.map(async library => {
					const linkPlaceholder = this.getLinkPlaceholder(library, artefact);
					if (linkPlaceholder) {
						return {
							linkPlaceholder: linkPlaceholder,
							address: (await library.deployed()).address
						};
					}
				})
			)
		}
		var coreCode = artefact.bytecode;
		librariesLinkPlaceHolderAndAddress
			.filter(data => data != undefined)
			.forEach(element => {
				// Replace `__$9d824026d0515d8abd681f0f0f4707f16a$__`
				// by address library without 0x prefix
				coreCode = coreCode.replaceAll(element.linkPlaceholder,
					element.address.slice(2).toLowerCase())
			});

		const argsCode         	= constructorABI ? ethers.utils.defaultAbiCoder.encode(constructorABI.inputs.map(e => e.type), args).slice(2) : '';
		const code             	= coreCode + argsCode;
		const salt             	= options.salt || ethers.constants.HashZero;
		const contractAddress	= options.call
			? await this.factory.predictAddressWithCall(code, salt, options.call)
			: await this.factory.predictAddress(code, salt);

		if (await this.factory.provider.getCode(contractAddress) == '0x')
		{
			console.log(`[factory] Preparing to deploy ${artefact.contractName} ...`);
			await waitTx(
				options.call
				? this.factory.createContractAndCall(code, salt, options.call)
				: this.factory.createContract(code, salt)
			);
			console.log(`[factory] ${artefact.contractName} successfully deployed at ${contractAddress}`);
		}
		else
		{
			console.log(`[factory] ${artefact.contractName} already deployed at ${contractAddress}`);
		}
		const instance = await artefact.at(contractAddress)
		artefact.setAsDeployed(instance)
	}

	getLinkPlaceholder(libraryArtefact, contractArtefact) {
		const hLibraryArtifact = libraryArtefact._hArtifact
		const hArtifact = contractArtefact._hArtifact
		if (hArtifact.linkReferences) {
			const linkSourceName = hArtifact.linkReferences[hLibraryArtifact.sourceName];
			if (linkSourceName) {
				const firstLinkData = linkSourceName[hLibraryArtifact.contractName][0];
				// linkPlaceholder code from:
				// https://github.com/NomicFoundation/hardhat/blob/v1.3.3/packages/buidler-truffle5/src/artifacts.ts#L123
				return contractArtefact.bytecode.substr(
					firstLinkData.start * 2 + 2,
					firstLinkData.length * 2
				);
			}
		}
	}
}

class TruffleDeployer extends EthersDeployer
{
	constructor(web3, wallet = 0, options = {})
	{
		const provider = new ethers.providers.Web3Provider(web3.currentProvider)
		super(provider.getSigner(wallet), options)
	}
}

module.exports = { EthersDeployer, TruffleDeployer }
