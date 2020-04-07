var GenericFactory = artifacts.require("@iexec/solidity/GenericFactory");
var FACTORY = require("@iexec/solidity/deployment/factory.json")

module.exports = async function(deployer, network, accounts)
{
	console.log("# web3 version:", web3.version);
	chainid   = await web3.eth.net.getId();
	chaintype = await web3.eth.net.getNetworkType();
	console.log("Chainid is:", chainid);
	console.log("Chaintype is:", chaintype);

	console.log(`Checking factory availability`)
	if (await web3.eth.getCode(FACTORY.address) !== "0x")
	{
		console.log(`→ Factory is available on this network`)
		GenericFactory.address = FACTORY.address;
	}
	else
	{
		try
		{
			console.log(`→ Factory is not yet deployed on ${chaintype} (${chainid})`)
			await web3.eth.sendTransaction({ from: accounts[0], to: FACTORY.deployer, value: FACTORY.cost });
			await web3.eth.sendSignedTransaction(FACTORY.tx);
			GenericFactory.address = FACTORY.address;
			console.log(`→ Factory deployed at address: ${(await GenericFactory.deployed()).address}`)
		}
		catch (e)
		{
			console.log(`→ Error deploying the factory`)
			console.log(`→ Using a non standard address`)
			await deployer.deploy(GenericFactory);
			console.log(`→ Factory deployed at address: ${(await GenericFactory.deployed()).address}`)
		}
	}
};
