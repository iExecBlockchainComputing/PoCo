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
