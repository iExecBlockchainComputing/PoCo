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
var RLC           = artifacts.require('rlc-faucet-contract/RLC')
var ERLCTokenSwap = artifacts.require('@iexec/erlc/ERLCTokenSwap')
var ERC1538Proxy  = artifacts.require('@iexec/solidity/ERC1538Proxy')

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
	deploymentOptions.v5.usekyc = !!process.env.KYC;

	if (deploymentOptions.v5.usekyc && chainid > 1000) // skip for mainnet and testnet use
	{
		const rlc            = await RLC.deployed();
		const erlc           = await ERLCTokenSwap.deployed();
		const core           = await ERC1538Proxy.deployed();
		const supply         = await rlc.totalSupply();
		const KYC_ADMIN_ROLE = await erlc.KYC_ADMIN_ROLE();

		await erlc.grantRole(KYC_ADMIN_ROLE, accounts[0]);
		await erlc.grantKYC([ core.address, ...accounts ]);
		await rlc.approveAndCall(erlc.address, supply.div(web3.utils.toBN(2)), '0x');
	}
};
