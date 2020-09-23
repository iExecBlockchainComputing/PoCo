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

const FACTORY          = require('@iexec/solidity/deployment/factory.json')
const ENSRegistry      = artifacts.require('@ensdomains/ens/build/contracts/ENSRegistry')
const FIFSRegistrar    = artifacts.require('@ensdomains/ens/build/contracts/FIFSRegistrar')
const ReverseRegistrar = artifacts.require('@ensdomains/ens/build/contracts/ReverseRegistrar')
const PublicResolver   = artifacts.require('@ensdomains/resolver/build/contracts/PublicResolver')

const LIBRARIES = [
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

	await deployer.deploy(ENSRegistry, { call: (new ethers.utils.Interface(ENSRegistry.abi)).encodeFunctionData('setOwner', [ ethers.constants.HashZero, wallet.address ]) });
	const ens = new ethers.Contract(ENSRegistry.networks[chainid].address, ENSRegistry.abi, wallet);

	await deployer.deploy(PublicResolver, { args: [ ens.address ] });
	const publicresolver = new ethers.Contract(PublicResolver.networks[chainid].address, PublicResolver.abi, wallet);

	await deployer.deploy(ReverseRegistrar, { args: [ ens.address, publicresolver.address ] });
	const reverseregistrar = new ethers.Contract(ReverseRegistrar.networks[chainid].address, ReverseRegistrar.abi, wallet);

	const domains = [{
		name:    'eth',
	},{
		name:    'iexec.eth',
	},{
		name:    'v5.iexec.eth',
	},{
		name:    'core.v5.iexec.eth',
		address: '0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f',
		setName: true,
	},{
		name:    'apps.v5.iexec.eth',
		address: '0xB1C52075b276f87b1834919167312221d50c9D16',
		setName: true,
	},{
		name:    'datasets.v5.iexec.eth',
		address: '0x799DAa22654128d0C64d5b79eac9283008158730',
		setName: true,
	},{
		name:    'workerpools.v5.iexec.eth',
		address: '0xC76A18c78B7e530A165c5683CB1aB134E21938B4',
		setName: true,
	},{
		name:    'resolver.eth',
		address: publicresolver.address,
	},{
		name:    'reverse',
	},{
		name:    'addr.reverse',
		owner:   reverseregistrar.address,
	}]

	// Register domains
	Promise.all(
		[
			...domains.filter(entry => entry.owner),
			...domains.filter(entry => !entry.owner && entry.name).map(entry => ({ ...entry, owner: wallet.address })),
		].map(async entry => ({ ...entry, _owner: await ens.owner(ethers.utils.namehash(entry.name)) }))
	).then(domains => {
		domains
		.filter(({ _owner, owner }) => _owner != owner)
		.reduce(async (promise, entry) => {
			await Promise.resolve(promise);
			console.log(`setSubnodeOwner(${entry.name}) → ${entry.owner}`)
			const i      = entry.name.indexOf('.')
			const label  = i == -1 ? entry.name : entry.name.substr(0, i)
			const parent = i == -1 ? ''         : entry.name.substr(i + 1)
			await (await ens.setSubnodeOwner(
				ethers.utils.namehash(parent),
				ethers.utils.id(label),
				entry.owner,
			)).wait();
		}, null)
	})

	// Set resolver
	Promise.all(
		[
			...domains.filter(entry => entry.resolver),
			...domains.filter(entry => !entry.resolver && entry.address).map(entry => ({ ...entry, resolver: publicresolver.address })),
		].map(async entry => ({ ...entry, _resolver: await ens.resolver(ethers.utils.namehash(entry.name)) }))
	).then(domains => {
		domains
		.filter(({ _resolver, resolver }) => _resolver != resolver)
		.reduce(async (promise, entry) => {
			await Promise.resolve(promise);
			console.log(`setResolver(${entry.name}) → ${entry.resolver}`)
			await (await ens.setResolver(
				ethers.utils.namehash(entry.name),
				entry.resolver,
			)).wait();
		}, null)
	})

	// Set addresse
	Promise.all(
		[
			...domains.filter(entry => entry.address),
		]
		.map(entry => ({ ...entry, resolverContract: entry.resolver ? new ethers.Contract(entry.resolver, PublicResolver.abi, wallet) : publicresolver }))
		.map(async entry => ({ ...entry, _address: await entry.resolverContract['addr(bytes32)'](ethers.utils.namehash(entry.name)) }))
	).then(domains => {
		domains
		.filter(({ _address, address }) => _address != address)
		.reduce(async (promise, entry) => {
			await Promise.resolve(promise);
			console.log(`setAddr(${entry.name}) → ${entry.address}`)
			await (await entry.resolverContract['setAddr(bytes32,address)'](
				ethers.utils.namehash(entry.name),
				entry.address,
			)).wait();
		}, null)
	})

	// Set reverse
	Promise.all(
		[
			...domains.filter(entry => entry.name && entry.address && entry.setName)
		]
		.map(entry => ({ ...entry, lookup: `${entry.address.toLowerCase().substr(2)}.addr.reverse` }))
		.map(async entry => {
			try
			{
				const reverseResolver = new ethers.Contract(await ens.resolver(ethers.utils.namehash(entry.lookup)), PublicResolver.abi, wallet)
				const name            = await reverseResolver.name(ethers.utils.namehash(entry.lookup))
				return name == entry.name ? null : entry
			}
			catch
			{
				return entry
			}
		})
	).then(domains => {
		domains
		.filter(Boolean)
		.reduce(async (promise, entry) => {
			await Promise.resolve(promise);
			console.log(`setName(${entry.address}) → ${entry.name}`)
			await (await (new ethers.Contract(entry.address, [ ethers.utils.FunctionFragment.fromString('setName(address,string)') ], wallet)).setName(ens.address, entry.name)).wait()
		}, null)
	})

})().catch(console.error);
