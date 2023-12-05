// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const deployer = require('../scripts/hardhat-truffle-utils');
const assert = require('assert');
// CONFIG
const CONFIG = require('../config/config.json');
// FactoryDeployer
const { TruffleDeployer: Deployer } = require('../utils/FactoryDeployer');
const { getFunctionSignatures } = require('./utils/getFunctionSignatures');
// Token
var RLC = artifacts.require('rlc-faucet-contract/RLC');
var ERLCTokenSwap = artifacts.require('@iexec/erlc/ERLCTokenSwap');
// ERC1538 core & delegates
var ERC1538Proxy = artifacts.require('@iexec/solidity/ERC1538Proxy');
var ERC1538Update = artifacts.require('@iexec/solidity/ERC1538UpdateDelegate');
var ERC1538Query = artifacts.require('@iexec/solidity/ERC1538QueryDelegate');
// Libraries
var IexecLibOrders = artifacts.require('IexecLibOrders_v5');
// Interface
var IexecInterfaceNative = artifacts.require('IexecInterfaceNative');
var IexecInterfaceToken = artifacts.require('IexecInterfaceToken');
// Delegates
var IexecAccessors = artifacts.require('IexecAccessorsDelegate');
var IexecAccessorsABILegacy = artifacts.require('IexecAccessorsABILegacyDelegate');
var IexecCategoryManager = artifacts.require('IexecCategoryManagerDelegate');
var IexecERC20 = artifacts.require('IexecERC20Delegate');
var IexecERC20KYC = artifacts.require('IexecERC20DelegateKYC');
var IexecEscrowNative = artifacts.require('IexecEscrowNativeDelegate');
var IexecEscrowToken = artifacts.require('IexecEscrowTokenDelegate');
var IexecEscrowTokenKYC = artifacts.require('IexecEscrowTokenDelegateKYC');
var IexecEscrowTokenSwap = artifacts.require('IexecEscrowTokenSwapDelegate');
var IexecMaintenance = artifacts.require('IexecMaintenanceDelegate');
var IexecMaintenanceExtra = artifacts.require('IexecMaintenanceExtraDelegate');
var IexecOrderManagement = artifacts.require('IexecOrderManagementDelegate');
var IexecPoco1 = artifacts.require('IexecPoco1Delegate');
var IexecPoco1KYC = artifacts.require('IexecPoco1DelegateKYC');
var IexecPoco2 = artifacts.require('IexecPoco2Delegate');
var IexecPoco2KYC = artifacts.require('IexecPoco2DelegateKYC');
var IexecRelay = artifacts.require('IexecRelayDelegate');
var ENSIntegration = artifacts.require('ENSIntegrationDelegate');
// Other contracts
var AppRegistry = artifacts.require('AppRegistry');
var DatasetRegistry = artifacts.require('DatasetRegistry');
var WorkerpoolRegistry = artifacts.require('WorkerpoolRegistry');

const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function (accounts) {
    console.log('# web3 version:', web3.version);
    const chainid = await web3.eth.net.getId();
    const chaintype = await web3.eth.net.getNetworkType();
    console.log('Chainid is:', chainid);
    console.log('Chaintype is:', chaintype);
    console.log('Deployer is:', accounts[0]);

    /* ------------------------- Existing deployment ------------------------- */
    const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
    deploymentOptions.v5.usekyc = !!process.env.KYC;

    const factoryDeployer = deploymentOptions.v5.usefactory && new Deployer(web3, accounts[0]);
    const salt = process.env.SALT || deploymentOptions.v5.salt;
    const libraries = [IexecLibOrders];

    /* ------------------------ Deploy & link library ------------------------ */
    if (deploymentOptions.v5.usefactory) {
        for (library of libraries) {
            await factoryDeployer.deploy(library);
        }
    } else {
        const iexecLibOrders = await deployer.deploy(IexecLibOrders);
        await deployer.link(
            iexecLibOrders,
            deploymentOptions.v5.usekyc ? IexecPoco1KYC : IexecPoco1,
        );
        await deployer.link(iexecLibOrders, IexecMaintenance);
        await deployer.link(iexecLibOrders, IexecOrderManagement);
    }

    /* ---------------------------- Modules list ----------------------------- */
    contracts = [
        ERC1538Update,
        ERC1538Query,
        IexecAccessors,
        IexecAccessorsABILegacy,
        IexecCategoryManager,
        deploymentOptions.v5.usekyc ? IexecERC20KYC : IexecERC20,
        deploymentOptions.asset == 'Native' && IexecEscrowNative,
        deploymentOptions.asset == 'Token' && deploymentOptions.v5.usekyc && IexecEscrowTokenKYC,
        deploymentOptions.asset == 'Token' && !deploymentOptions.v5.usekyc && IexecEscrowToken,
        deploymentOptions.asset == 'Token' &&
            !deploymentOptions.v5.usekyc &&
            deploymentOptions.uniswap &&
            IexecEscrowTokenSwap,
        IexecMaintenance,
        IexecOrderManagement,
        deploymentOptions.v5.usekyc ? IexecPoco1KYC : IexecPoco1,
        deploymentOptions.v5.usekyc ? IexecPoco2KYC : IexecPoco2,
        IexecRelay,
        ENSIntegration,
        chainid != 1 && IexecMaintenanceExtra,
    ].filter(Boolean);

    /* --------------------------- Deploy modules ---------------------------- */
    for (module of contracts) {
        deploymentOptions.v5.usefactory
            ? await factoryDeployer.deploy(module, { libraries })
            : await deployer.deploy(module);
    }

    /* ---------------------------- Deploy proxy ----------------------------- */
    if (deploymentOptions.v5.usefactory) {
        await factoryDeployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address, {
            call: web3.eth.abi.encodeFunctionCall(
                ERC1538Proxy._json.abi.find((e) => e.name == 'transferOwnership'),
                [accounts[0]],
            ),
            salt: process.env.PROXY_SALT || salt,
        });
    } else {
        await deployer.deploy(ERC1538Proxy, (await ERC1538Update.deployed()).address);
    }
    ERC1538 = await ERC1538Update.at((await ERC1538Proxy.deployed()).address);
    console.log(`IexecInstance deployed at address: ${ERC1538.address}`);

    /* --------------------------- Setup modules ---------------------------- */
    for (module of contracts.filter((module) => module != ERC1538Update)) {
        console.log(`ERC1538 link: ${module.contractName}`);
        await ERC1538.updateContract(
            (await module.deployed()).address,
            getFunctionSignatures(module.abi),
            'Linking ' + module.contractName,
        );
    }

    /* --------------------------- Configure Stack --------------------------- */
    IexecInterfaceInstance = await IexecInterfaceToken.at(ERC1538.address);

    if (deploymentOptions.v5.AppRegistry) AppRegistry.address = deploymentOptions.v5.AppRegistry;
    if (deploymentOptions.v5.DatasetRegistry)
        DatasetRegistry.address = deploymentOptions.v5.DatasetRegistry;
    if (deploymentOptions.v5.WorkerpoolRegistry)
        WorkerpoolRegistry.address = deploymentOptions.v5.WorkerpoolRegistry;
    if (deploymentOptions.v5.usefactory) {
        AppRegistry.isDeployed() ||
            (await factoryDeployer.deploy(AppRegistry, {
                call: web3.eth.abi.encodeFunctionCall(
                    AppRegistry._json.abi.find((e) => e.name == 'transferOwnership'),
                    [accounts[0]],
                ),
                salt,
            }));
        DatasetRegistry.isDeployed() ||
            (await factoryDeployer.deploy(DatasetRegistry, {
                call: web3.eth.abi.encodeFunctionCall(
                    DatasetRegistry._json.abi.find((e) => e.name == 'transferOwnership'),
                    [accounts[0]],
                ),
                salt,
            }));
        WorkerpoolRegistry.isDeployed() ||
            (await factoryDeployer.deploy(WorkerpoolRegistry, {
                call: web3.eth.abi.encodeFunctionCall(
                    WorkerpoolRegistry._json.abi.find((e) => e.name == 'transferOwnership'),
                    [accounts[0]],
                ),
                salt,
            }));
    } else {
        AppRegistry.isDeployed() || (await deployer.deploy(AppRegistry));
        DatasetRegistry.isDeployed() || (await deployer.deploy(DatasetRegistry));
        WorkerpoolRegistry.isDeployed() || (await deployer.deploy(WorkerpoolRegistry));
    }

    switch (deploymentOptions.asset) {
        case 'Token':
            if (deploymentOptions.v5.usekyc) {
                TokenInstance = await ERLCTokenSwap.deployed();
            } else {
                TokenInstance = await RLC.deployed();
            }
            break;

        case 'Native':
            TokenInstance = { address: ADDRESS_ZERO };
            break;
    }

    AppRegistryInstance = await AppRegistry.deployed();
    DatasetRegistryInstance = await DatasetRegistry.deployed();
    WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
    console.log(`AppRegistry        deployed at address: ${AppRegistryInstance.address}`);
    console.log(`DatasetRegistry    deployed at address: ${DatasetRegistryInstance.address}`);
    console.log(`WorkerpoolRegistry deployed at address: ${WorkerpoolRegistryInstance.address}`);
    console.log(`Using token:                            ${TokenInstance.address}`);

    const AppRegistryInitialized = await AppRegistryInstance.initialized();
    const DatasetRegistryInitialized = await DatasetRegistryInstance.initialized();
    const WorkerpoolRegistryInitialized = await WorkerpoolRegistryInstance.initialized();
    const IexecInterfaceInitialized =
        (await IexecInterfaceInstance.eip712domain_separator()) != BYTES32_ZERO;

    !AppRegistryInitialized &&
        (await AppRegistryInstance.initialize(deploymentOptions.v3.AppRegistry || ADDRESS_ZERO));
    !DatasetRegistryInitialized &&
        (await DatasetRegistryInstance.initialize(
            deploymentOptions.v3.DatasetRegistry || ADDRESS_ZERO,
        ));
    !WorkerpoolRegistryInitialized &&
        (await WorkerpoolRegistryInstance.initialize(
            deploymentOptions.v3.WorkerpoolRegistry || ADDRESS_ZERO,
        ));
    !AppRegistryInitialized &&
        (await AppRegistryInstance.setBaseURI(`https://nfts-metadata.iex.ec/app/${chainid}/`));
    !DatasetRegistryInitialized &&
        (await DatasetRegistryInstance.setBaseURI(
            `https://nfts-metadata.iex.ec/dataset/${chainid}/`,
        ));
    !WorkerpoolRegistryInitialized &&
        (await WorkerpoolRegistryInstance.setBaseURI(
            `https://nfts-metadata.iex.ec/workerpool/${chainid}/`,
        ));
    !IexecInterfaceInitialized &&
        (await IexecInterfaceInstance.configure(
            TokenInstance.address,
            deploymentOptions.v5.usekyc ? 'Staked eRLC' : 'Staked RLC',
            deploymentOptions.v5.usekyc ? 'SeRLC' : 'SRLC',
            9, // TODO: generic ?
            AppRegistryInstance.address,
            DatasetRegistryInstance.address,
            WorkerpoolRegistryInstance.address,
            ADDRESS_ZERO,
        ));

    /* ----------------------------- Categories ------------------------------ */

    const catCountBefore = await IexecInterfaceInstance.countCategory();
    await CONFIG.categories.slice(catCountBefore.toNumber()).reduce(async (promise, category) => {
        await promise;
        await IexecInterfaceInstance.createCategory(
            category.name,
            JSON.stringify(category.description),
            category.workClockTimeRef,
        );
    }, Promise.resolve());

    const catCountAfter = await IexecInterfaceInstance.countCategory();
    console.log(`countCategory is now: ${catCountAfter}`);
    (
        await Promise.all(
            Array(catCountAfter.toNumber())
                .fill()
                .map((_, i) => IexecInterfaceInstance.viewCategory(i)),
        )
    ).forEach((category, i) => console.log(['category', i, ':', ...category].join(' ')));
};
