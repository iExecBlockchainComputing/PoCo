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
// ENS
var ENSRegistry             = artifacts.require('@ensdomains/ens/ENSRegistry')
var FIFSRegistrar           = artifacts.require('@ensdomains/ens/FIFSRegistrar')
var ReverseRegistrar        = artifacts.require('@ensdomains/ens/ReverseRegistrar.sol')
var PublicResolver          = artifacts.require('@ensdomains/resolver/PublicResolver')
// Core
var RLC                     = artifacts.require('rlc-faucet-contract/RLC')
var KERC20                  = artifacts.require('KERC20')
var ERC1538Proxy            = artifacts.require('@iexec/solidity/ERC1538Proxy')
var IexecInterfaceNative    = artifacts.require('IexecInterfaceNative')
var IexecInterfaceToken     = artifacts.require('IexecInterfaceToken')
var AppRegistry             = artifacts.require('AppRegistry')
var DatasetRegistry         = artifacts.require('DatasetRegistry')
var WorkerpoolRegistry      = artifacts.require('WorkerpoolRegistry')

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
	const factoryOptions    = { salt: deploymentOptions.v5.salt || web3.utils.randomHex(32) };

	/* ----------------------------- Deploy ENS ------------------------------ */
	if (chainid > 1000) // skip for mainnet and testnet use
	{
		var ens        = null;
		var resolver   = null;
		var registrars = {};

		function labelhash(label)
		{
			return web3.utils.keccak256(label.toLowerCase());
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
			reverseregistrar = await ReverseRegistrar.deployed();

			await registrars[''].register(labelhash('reverse'), accounts[0], { from: accounts[0] });
			await ens.setSubnodeOwner(namehash('reverse'), labelhash('addr'), reverseregistrar.address);
		}

		async function registerDomain(label, domain='')
		{
			const name      = domain ? `${label}.${domain}` : `${label}`;
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
			const name      = `${label}.${domain}`;
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
		await registerDomain('v5',    'iexec.eth');
		await registerDomain('users', 'iexec.eth');

		/* ------------------------- Fetching contracts -------------------------- */
		switch (deploymentOptions.asset)
		{
			case 'Token':  IexecInterfaceInstance = await IexecInterfaceToken.at((await ERC1538Proxy.deployed()).address);  break;
			case 'Native': IexecInterfaceInstance = await IexecInterfaceNative.at((await ERC1538Proxy.deployed()).address); break;
		}

		const RLCInstance                = deploymentOptions.asset == 'Token' && await RLC.deployed();
		const ERLCInstance               = deploymentOptions.asset == 'Token' && deploymentOptions.v5.useKYC && await KERC20.deployed();
		const AppRegistryInstance        = await AppRegistry.deployed();
		const DatasetRegistryInstance    = await DatasetRegistry.deployed();
		const WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		await Promise.all([
			                             registerAddress('admin',       'iexec.eth',    accounts[0]),
			RLCInstance                ? registerAddress('rlc',         'iexec.eth',    RLCInstance.address               ) : null,
			ERLCInstance               ? registerAddress('erlc',        'iexec.eth',    ERLCInstance.address              ) : null,
			IexecInterfaceInstance     ? registerAddress('core',        'v5.iexec.eth', IexecInterfaceInstance.address    ) : null,
			AppRegistryInstance        ? registerAddress('apps',        'v5.iexec.eth', AppRegistryInstance.address       ) : null,
			DatasetRegistryInstance    ? registerAddress('datasets',    'v5.iexec.eth', DatasetRegistryInstance.address   ) : null,
			WorkerpoolRegistryInstance ? registerAddress('workerpools', 'v5.iexec.eth', WorkerpoolRegistryInstance.address) : null,
			                                       reverseregistrar.setName('admin.iexec.eth', { from: accounts[0] }),
			IexecInterfaceInstance     ?     IexecInterfaceInstance.setName(ens.address, 'core.v5.iexec.eth'       ) : null,
			AppRegistryInstance        ?        AppRegistryInstance.setName(ens.address, 'apps.v5.iexec.eth'       ) : null,
			DatasetRegistryInstance    ?    DatasetRegistryInstance.setName(ens.address, 'datasets.v5.iexec.eth'   ) : null,
			WorkerpoolRegistryInstance ? WorkerpoolRegistryInstance.setName(ens.address, 'workerpools.v5.iexec.eth') : null,
		].filter(Boolean));
	}
};
