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

const assert            = require('assert')
const CONFIG            = require('../../config/config.json')
var GenericFactory      = artifacts.require('@iexec/solidity/GenericFactory')
var ERC1538Proxy        = artifacts.require('@iexec/solidity/ERC1538Proxy')
var ERC1538Update       = artifacts.require('@iexec/solidity/ERC1538UpdateDelegate')

const { ethers } = require('ethers');

/*****************************************************************************
 *                               Configuration                               *
 *****************************************************************************/
const LIBRARIES = [
	artifacts.require('IexecLibOrders_v5'),
]

const MODULES = [
	// { module: artifacts.require('IexecEscrowNativeDelegate'),    methods: null },
	// { module: artifacts.require('IexecEscrowTokenDelegate'),     methods: null },
	{ module: artifacts.require('IexecEscrowTokenSwapDelegate'), methods: null },
]

const FUNCTIONS = [
]

/*****************************************************************************
 *                                   Tools                                   *
 *****************************************************************************/
function getSerializedObject(entry)
{
	return (entry.type == 'tuple')
		? `(${entry.components.map(getSerializedObject).join(',')})`
		: entry.type;
}

function getFunctionSignatures(abi)
{
	return abi
		.filter(entry => entry.type == 'function')
		.map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`)
		.join('')
	+ (abi.some(entry => entry.type == 'receive' ) ? 'receive;'  : '')
	+ (abi.some(entry => entry.type == 'fallback') ? 'fallback;' : '');
}

async function factoryDeployer(contract, options = {})
{
	console.log(`[factoryDeployer] ${contract.contractName}`);
	const factory          = await GenericFactory.deployed();
	const libraryAddresses = await Promise.all(
		LIBRARIES
		.filter(({ contractName }) => contract.bytecode.search(contractName) != -1)
		.map(async ({ contractName, deployed }) => ({
			pattern: new RegExp(`__${contractName}${'_'.repeat(38-contractName.length)}`, 'g'),
			...await deployed()
		}))
	);

	const constructorABI   = contract._json.abi.find(e => e.type == 'constructor');
	const coreCode         = libraryAddresses.reduce((code, { pattern, address }) => code.replace(pattern, address.slice(2).toLowerCase()), contract.bytecode);
	const argsCode         = constructorABI ? web3.eth.abi.encodeParameters(constructorABI.inputs.map(e => e.type), options.args || []).slice(2) : '';
	const code             = coreCode + argsCode;
	const salt             = options.salt  || '0x0000000000000000000000000000000000000000000000000000000000000000';

	contract.address = options.call
		? await factory.predictAddressWithCall(code, salt, options.call)
		: await factory.predictAddress(code, salt);

	if (await web3.eth.getCode(contract.address) == '0x')
	{
		console.log(`[factory] Preparing to deploy ${contract.contractName} ...`);
		options.call
			? await factory.createContractAndCall(code, salt, options.call)
			: await factory.createContract(code, salt);
		console.log(`[factory] ${contract.contractName} successfully deployed at ${contract.address}`);
	}
	else
	{
		console.log(`[factory] ${contract.contractName} already deployed`);
	}
}
/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async (callback) => {
	try
	{
		console.log('# web3 version:', web3.version);
		const chainid   = await web3.eth.net.getId();
		const chaintype = await web3.eth.net.getNetworkType();
		console.log('Chainid is:', chainid);
		console.log('Chaintype is:', chaintype);

		// Load config
		const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
		const factoryOptions    = { salt: deploymentOptions.v5.salt || web3.utils.randomHex(32) };

		// Load core
		const proxy = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
		console.log('Deploying to proxy:', proxy.address);

		// Module updates
		for ([ i, { module, methods } ] of Object.entries(MODULES.filter(Boolean)))
		{
			console.log(`[${i}] ERC1538 link: ${module.contractName}`);
			// deploy module
			if (deploymentOptions.v5.usefactory)
			{
				await factoryDeployer(module, factoryOptions);
			}
			else
			{
				await deployer.deploy(module);
			}
			// update proxy
			await proxy.updateContract(
				(await module.deployed()).address,
				getFunctionSignatures(module.abi.filter(entry => !methods || methods.indexOf(entry.name) != -1)),
				`Linking module ${module.contractName}`
			);
		}

		// Function updates
		for ([ i, { func, address } ] of Object.entries(FUNCTIONS.filter(Boolean)))
		{
			// format, add ';' if needed.
			if (!func.endsWith(';')) { func += ';'; }
			// update proxy
			console.log(`[${i}] Linking function: ${func} → ${address}`);
			await proxy.updateContract(address, func, `Updating function ${func}`);
		}

		/*************************************************************************
		 *************************************************************************
		 **                               TESTING                               **
		 *************************************************************************
		 *************************************************************************/

		if (process.env.TEST)
		{
			const query       = await artifacts.require('@iexec/solidity/ERC1538QueryDelegate').at(proxy.address);
			const iexec       = await artifacts.require('IexecInterfaceToken'                 ).at(proxy.address);
			const rlc         = await artifacts.require('IERC20'                              ).at(await iexec.token());
			const apps        = await artifacts.require('AppRegistry'                         ).at(await iexec.appregistry());
			const datasets    = await artifacts.require('DatasetRegistry'                     ).at(await iexec.datasetregistry());
			const workerpools = await artifacts.require('WorkerpoolRegistry'                  ).at(await iexec.workerpoolregistry());

			console.log('Using proxy at:       ', proxy.address);
			console.log('owner:                ', await iexec.owner());
			console.log('totalSupply:          ', (await iexec.totalSupply()).toString());
			console.log('active methods count: ', (await query.totalFunctions()).toString());

			// (await Promise.all(
			// 	Array((await query.totalFunctions()).toNumber()).fill().map((_, i) => query.functionByIndex(i))
			// ))
			// .forEach((details, i) => console.log(`[${i}] ${details.delegate} ${details.signature}`));

			const accounts = await web3.eth.getAccounts();
			console.log("Before:");
			console.log("- ETH balance:  ", await web3.eth.getBalance(iexec.address));
			console.log("- RLC balance:  ", (await rlc.balanceOf(iexec.address)).toString());
			console.log("- Total supply: ", (await iexec.totalSupply()).toString());

			if (await apps.balanceOf(accounts[0]) == 0)
			{
				console.log("deploy fake app");
				await apps.createApp(
					accounts[0],
					"FakeApp",
					"DOCKER",
					"0x",
					ethers.constants.HashZero,
					"0x",
				);
			}
			if (await datasets.balanceOf(accounts[0]) == 0)
			{
				console.log("deploy fake dataset");
				await datasets.createDataset(
					accounts[0],
					"FakeDataset",
					"0x",
					ethers.constants.HashZero,
				);
			}
			if (await workerpools.balanceOf(accounts[0]) == 0)
			{
				console.log("deploy fake workerpool");
				await workerpools.createWorkerpool(
					accounts[0],
					"FakeWorkerpool",
				);
			}

			const app        = ethers.utils.hexZeroPad(ethers.BigNumber.from((await        apps.tokenOfOwnerByIndex(accounts[0], 0)).toString()), 20);
			const dataset    = ethers.utils.hexZeroPad(ethers.BigNumber.from((await    datasets.tokenOfOwnerByIndex(accounts[0], 0)).toString()), 20);
			const workerpool = ethers.utils.hexZeroPad(ethers.BigNumber.from((await workerpools.tokenOfOwnerByIndex(accounts[0], 0)).toString()), 20);

			const apporder = {
				app,
				appprice:           20,
				volume:             1000,
				tag:                ethers.constants.HashZero,
				datasetrestrict:    ethers.constants.AddressZero,
				workerpoolrestrict: ethers.constants.AddressZero,
				requesterrestrict:  ethers.constants.AddressZero,
				salt:               ethers.utils.randomBytes(32),
				sign:               "0x",
			}
			const datasetorder = {
				dataset,
				datasetprice:       60,
				volume:             1000,
				tag:                ethers.constants.HashZero,
				apprestrict:        ethers.constants.AddressZero,
				workerpoolrestrict: ethers.constants.AddressZero,
				requesterrestrict:  ethers.constants.AddressZero,
				salt:               ethers.utils.randomBytes(32),
				sign:               "0x",
			}
			const workerpoolorder = {
				workerpool,
				workerpoolprice:   0,
				volume:            3,
				category:          4,
				trust:             ethers.constants.Zero,
				tag:               ethers.constants.AddressZero,
				apprestrict:       ethers.constants.AddressZero,
				datasetrestrict:   ethers.constants.AddressZero,
				requesterrestrict: ethers.constants.AddressZero,
				salt:              ethers.utils.randomBytes(32),
				sign:              "0x",
			}
			const requestorder = {
				app,
				appmaxprice:        100,
				dataset,
				datasetmaxprice:    100,
				workerpool,
				workerpoolmaxprice: 100,
				volume:             10, // CHANGE FOR BOT
				category:           4,
				trust:              ethers.constants.Zero,
				tag:                ethers.constants.HashZero,
				requester:          accounts[0],
				beneficiary:        accounts[0],
				callback:           ethers.constants.AddressZero,
				params:             "",
				salt:               ethers.utils.randomBytes(32),
				sign:               "0x",
			}

			await iexec.manageAppOrder       ({ order: apporder,        operation: 0, sign: "0x" });
			await iexec.manageDatasetOrder   ({ order: datasetorder,    operation: 0, sign: "0x" });
			await iexec.manageWorkerpoolOrder({ order: workerpoolorder, operation: 0, sign: "0x" });
			await iexec.manageRequestOrder   ({ order: requestorder,    operation: 0, sign: "0x" });

			// const tx = await web3.eth.sendTransaction({ from: accounts[0], to: iexec.address, value: "100000000000000000" });
			// const tx = await iexec.depositEth({ value: "10000000000000000" })
			// const tx = await iexec.withdrawEth(126492)
			// const tx = await iexec.requestToken(10, { value: "10000000000000000" })
			const tx = await iexec.matchOrdersWithEth(apporder, datasetorder, workerpoolorder, requestorder, { value: "10000000000000000", from: accounts[1] });

			tx.logs
			.filter(({ event }) => event == 'Transfer')
			.forEach(({address, event, args}) => {
				console.log(`[ ${address} | ${event} ]`)
				console.log(args.from.toString())
				console.log(args.to.toString())
				console.log(args.value.toString())
			})

			console.log("After:");
			console.log("- ETH balance:  ", await web3.eth.getBalance(iexec.address));
			console.log("- RLC balance:  ", (await rlc.balanceOf(iexec.address)).toString());
			console.log("- Total supply: ", (await iexec.totalSupply()).toString());
		}

	}
	catch (e)
	{
		callback(e)
	}
	finally
	{
		callback()
	}
}
