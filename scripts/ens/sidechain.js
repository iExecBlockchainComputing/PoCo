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

const { ethers }                          = require('ethers');
const { EthersDeployer: FactoryDeployer } = require('../../utils/FactoryDeployer');
const ENSRegistry                         = require('@ensdomains/ens/build/contracts/ENSRegistry.json');
const FIFSRegistrar                       = require('@ensdomains/ens/build/contracts/FIFSRegistrar.json');
const ReverseRegistrar                    = require('@ensdomains/ens/build/contracts/ReverseRegistrar.json');
const PublicResolver                      = require('@ensdomains/resolver/build/contracts/PublicResolver.json');

(async() => {

	const provider = new ethers.getDefaultProvider(process.env.NODE);
	const wallet   = new ethers.Wallet(process.env.MNEMONIC, provider);
	const deployer = new FactoryDeployer(wallet);

	await deployer.deploy(ENSRegistry, { call: (new ethers.utils.Interface(ENSRegistry.abi)).encodeFunctionData('setOwner', [ ethers.constants.HashZero, wallet.address ]) });
	const ens = new ethers.Contract(ENSRegistry.address, ENSRegistry.abi, wallet);

	await deployer.deploy(PublicResolver, { args: [ ens.address ] });
	const publicresolver = new ethers.Contract(PublicResolver.address, PublicResolver.abi, wallet);

	await deployer.deploy(ReverseRegistrar, { args: [ ens.address, publicresolver.address ] });
	const reverseregistrar = new ethers.Contract(ReverseRegistrar.address, ReverseRegistrar.abi, wallet);

	const domains = [{
		name:    'eth',
	},{
		name:    'iexec.eth',
	},{
		name:    'erlc.iexec.eth',
		address: '0x0000000000000000000000000000000000000000',
	},{
		name:    'timelock.iexec.eth',
		address: '0x4611B943AA1d656Fc669623b5DA08756A7e288E9',
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
	await new Promise(resolve => {
		Promise.all(
			domains
			.filter(entry => entry.name)
			.map(async entry => ({ ...entry, owner: entry.owner || wallet.address, _owner: await ens.owner(ethers.utils.namehash(entry.name)) }))
		).then(_ => {
			_
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
			}, Promise.resolve())
			.then(resolve)
		})
	})

	// Set resolver
	await new Promise(resolve => {
		Promise.all(
			domains
			.filter(entry => entry.resolver || entry.address)
			.map(async entry => ({ ...entry, resolver: entry.resolver || publicresolver.address, _resolver: await ens.resolver(ethers.utils.namehash(entry.name)) }))
		).then(_ => {
			_
			.filter(({ _resolver, resolver }) => _resolver != resolver)
			.reduce(async (promise, entry) => {
				await Promise.resolve(promise);
				console.log(`setResolver(${entry.name}) → ${entry.resolver}`)
				await (await ens.setResolver(
					ethers.utils.namehash(entry.name),
					entry.resolver,
				)).wait();
			}, Promise.resolve())
			.then(resolve)
		})
	})

	// Set address
	await new Promise(resolve => {
		Promise.all(
			domains
			.filter(entry => entry.address)
			.map(async entry => {
				try
				{
					const resolverContract = new ethers.Contract(await ens.resolver(ethers.utils.namehash(entry.name)), PublicResolver.abi, wallet)
					const address          = await resolverContract['addr(bytes32)'](ethers.utils.namehash(entry.name))
					return address == entry.address ? null : { ...entry, resolverContract }
				}
				catch
				{
					return null // invalid resolverContract
				}
			})
		).then(_ => {
			_
			.filter(Boolean)
			.reduce(async (promise, entry) => {
				await Promise.resolve(promise);
				console.log(`setAddr(${entry.name}) → ${entry.address}`)
				await (await entry.resolverContract['setAddr(bytes32,address)'](
					ethers.utils.namehash(entry.name),
					entry.address,
				)).wait();
			}, Promise.resolve())
			.then(resolve)
		})
	})

	// Set reverse
	await new Promise(resolve => {
		Promise.all(
			domains
			.filter(entry => entry.name && entry.address && entry.setName)
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
					return entry // reverseResolver not set
				}
			})
		).then(_ => {
			_
			.filter(Boolean)
			.reduce(async (promise, entry) => {
				await Promise.resolve(promise);
				console.log(`setName(${entry.address}) → ${entry.name}`)
				await (await (new ethers.Contract(entry.address, [ ethers.utils.FunctionFragment.fromString('setName(address,string)') ], wallet)).setName(ens.address, entry.name)).wait()
			}, Promise.resolve())
			.then(resolve)
		})
	})

})().catch(console.error);
