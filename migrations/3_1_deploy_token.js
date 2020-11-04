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

// CONFIG
const CONFIG = require('../config/config.json')
// Token
var RLC = artifacts.require('rlc-faucet-contract/RLC')

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

	const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;

	switch (deploymentOptions.asset)
	{
		case 'Token':
			if (deploymentOptions.token)
			{
				RLCInstance = await RLC.at(deploymentOptions.token);
			}
			else
			{
				await deployer.deploy(RLC);
				RLCInstance = await RLC.deployed();
			}
			break;

		case 'Native':
			RLCInstance = { address: '0x0000000000000000000000000000000000000000' };
			break;
	}
};
