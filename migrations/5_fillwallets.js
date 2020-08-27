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

const assert   = require('assert')
// CONFIG
const CONFIG   = require('../config/config.json')
const ACCOUNTS = require('../config/accounts.json')
// Token
var RLC                  = artifacts.require('rlc-faucet-contract/RLC')
// ERC1538 core & delegates
var ERC1538Proxy         = artifacts.require('@iexec/solidity/ERC1538Proxy')
// Interface
var IexecInterfaceNative = artifacts.require('IexecInterfaceNative')
var IexecInterfaceToken  = artifacts.require('IexecInterfaceToken')

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
		case 'Token':  IexecInterfaceInstance = await IexecInterfaceToken.at((await ERC1538Proxy.deployed()).address);  break;
		case 'Native': IexecInterfaceInstance = await IexecInterfaceNative.at((await ERC1538Proxy.deployed()).address); break;
	}

	if (chainid > 1000) // skip for mainnet and testnet
	{
		const totalAmount = ACCOUNTS.reduce((acc, {amount})=> acc + amount, 0); // 1RLC

		switch (deploymentOptions.asset)
		{
			case 'Token':
				await (await RLC.deployed()).approveAndCall(IexecInterfaceInstance.address, totalAmount, "0x");
				break;

			case 'Native':
				await IexecInterfaceInstance.deposit({ value: totalAmount * 10**9 }) // wei → nrlc
				break;
		}

		// all transfers
		await Promise.all(ACCOUNTS.map( async ({address, amount}) => {
			await IexecInterfaceInstance.transfer(address, amount);
			console.log(`${address} received ${amount}`);
		}))
	}
};
