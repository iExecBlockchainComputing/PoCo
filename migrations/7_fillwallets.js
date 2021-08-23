const assert   = require('assert')
// CONFIG
const CONFIG   = require('../config/config.json')
const ACCOUNTS = require('../config/accounts.json')
// Token
var RLC                 = artifacts.require('rlc-faucet-contract/RLC')
// ERC1538 core & delegates
var ERC1538Proxy        = artifacts.require('@iexec/solidity/ERC1538Proxy')
// Interface
var IexecInterfaceToken = artifacts.require('IexecInterfaceToken')

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

	if (chainid > 64 && !process.env.KYC) // skip for mainnet, testnet and enterprise
	{
		const totalAmount = 1000000000; // 1RLC

		switch (deploymentOptions.asset)
		{
			case 'Token':
                RLCInstance = await RLC.deployed();
                await RLCInstance.approveAndCall(IexecInterfaceInstance.address, totalAmount, "0x");
				break;
			case 'Native':
				await IexecInterfaceInstance.deposit({ value: totalAmount })
				break;
		}

		// all transfers
		await Promise.all(ACCOUNTS.map(({address, amount}) => IexecInterfaceInstance.transfer(address, amount)))
	}
};
