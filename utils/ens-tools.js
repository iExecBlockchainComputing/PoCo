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

var ENSRegistry    = artifacts.require("./ENSRegistry.sol");
var PublicResolver = artifacts.require("./PublicResolver.sol");
var FIFSRegistrar  = artifacts.require("./FIFSRegistrar.sol");

module.exports = {

	labelhash: function(label)
	{
		return web3.utils.keccak256(label.toLowerCase())
	},

	compose: function(labelHash, rootHash)
	{
		return web3.utils.keccak256(web3.eth.abi.encodeParameters([ "bytes32", "bytes32" ], [ rootHash,  labelHash ]));
	},

	namehash: function(domain)
	{
		return domain.split('.').reverse().reduce(
			(hash, label) => this.compose(this.labelhash(label), hash),
			"0x0000000000000000000000000000000000000000000000000000000000000000"
		);
	},

	resolve: async function(name)
	{
		node         = this.namehash(name);
		registry     = await ENSRegistry.deployed();
		resolveraddr = await registry.resolver(node);
		resolver     = await PublicResolver.at(resolveraddr);
		addr         = await resolver.addr(node);
		return addr;
	},

	lookup: async function(addr)
	{
		node         = this.namehash(`${addr.substring(2)}.addr.reverse`);
		registry     = await ENSRegistry.deployed();
		resolveraddr = await registry.resolver(node);
		resolver     = await PublicResolver.at(resolveraddr);
		name         = await resolver.name(node);
		return name;
	},

};
