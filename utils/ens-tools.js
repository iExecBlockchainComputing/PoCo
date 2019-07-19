var ENSRegistry    = artifacts.require("./ENSRegistry.sol");
var PublicResolver = artifacts.require("./PublicResolver.sol");
var FIFSRegistrar  = artifacts.require("./FIFSRegistrar.sol");

module.exports = {

	labelhash: function(label)
	{
		return web3.utils.keccak256(label.toLowerCase())
	},

	namehash: function (domain)
	{
		hash = "0x0000000000000000000000000000000000000000000000000000000000000000";
		domain.split('.').reverse().forEach(label => {
			hash = web3.utils.keccak256(web3.eth.abi.encodeParameters([ "bytes32", "bytes32" ], [ hash,  this.labelhash(label) ]));
		});
		return hash
	},

	resolve: async function (name)
	{
		node         = this.namehash(name);
		registry     = await ENSRegistry.deployed();
		resolveraddr = await registry.resolver(node);
		resolver     = await PublicResolver.at(resolveraddr);
		addr         = await resolver.addr(node);
		return addr;
	},

	lookup: async function (address)
	{
		node         = this.namehash(`${addr.substring(2)}.addr.reverse`);
		registry     = await ENSRegistry.deployed();
		resolveraddr = await registry.resolver(node);
		resolver     = await PublicResolver.at(resolveraddr);
		name         = await resolver.name(node);
		return name;
	}

};
