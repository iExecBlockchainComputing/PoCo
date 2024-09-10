// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import fs from 'fs';
import hre, { ethers } from 'hardhat';
import path from 'path';
import { getFunctionSignatures } from '../migrations/utils/getFunctionSignatures';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    ENSIntegrationDelegate__factory,
    ERC1538Proxy__factory,
    ERC1538Query,
    ERC1538QueryDelegate__factory,
    ERC1538Query__factory,
    ERC1538Update,
    ERC1538UpdateDelegate__factory,
    ERC1538Update__factory,
    IexecAccessorsABILegacyDelegate__factory,
    IexecAccessorsDelegate__factory,
    IexecAccessors__factory,
    IexecCategoryManagerDelegate__factory,
    IexecCategoryManager__factory,
    IexecERC20Delegate__factory,
    IexecEscrowNativeDelegate__factory,
    IexecEscrowTokenDelegate__factory,
    IexecLibOrders_v5__factory,
    IexecMaintenanceDelegate__factory,
    IexecMaintenanceExtraDelegate__factory,
    IexecOrderManagementDelegate__factory,
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate__factory,
    IexecRelayDelegate__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../typechain';
import { Ownable__factory } from '../typechain/factories/@openzeppelin/contracts/access';
import { FactoryDeployerHelper } from '../utils/FactoryDeployerHelper';
import { getBaseNameFromContractFactory } from '../utils/deploy-tools';
import { Category } from '../utils/poco-tools';
const CONFIG = require('../config/config.json');

/**
 * @dev Deploying contracts with `npx hardhat deploy` task brought by
 * `hardhat-deploy` plugin.
 * Previous deployments made with `npx hardhat run scripts/deploy.ts` used to
 * hang at the end of deployments (terminal did not return at the end).
 *
 * Note:
 * The`hardhat-deploy` plugin is currently being under used compared to all
 * features available in it.
 */
module.exports = async function () {
    console.log('Deploying PoCo..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await hre.ethers.getSigners();
    const deploymentOptions = CONFIG.chains[chainId] || CONFIG.chains.default;
    const salt = process.env.SALT || deploymentOptions.v5.salt || ethers.constants.HashZero;
    const factoryDeployer = new FactoryDeployerHelper(owner, salt);
    // Deploy RLC
    const isTokenMode = deploymentOptions.asset == 'Token';
    let rlcInstanceAddress = isTokenMode
        ? await getOrDeployRlc(deploymentOptions.token, owner) // token
        : ethers.constants.AddressZero; // native
    console.log(`RLC: ${rlcInstanceAddress}`);
    // Deploy ERC1538 proxy contracts
    const erc1538UpdateAddress = await factoryDeployer.deployWithFactory(
        new ERC1538UpdateDelegate__factory(),
    );
    const transferOwnershipCall = await Ownable__factory.connect(
        ethers.constants.AddressZero, // any is fine
        owner, // any is fine
    )
        .populateTransaction.transferOwnership(owner.address)
        .then((tx) => tx.data)
        .catch(() => {
            throw new Error('Failed to prepare transferOwnership data');
        });
    const erc1538ProxyAddress = await factoryDeployer.deployWithFactory(
        new ERC1538Proxy__factory(),
        [erc1538UpdateAddress],
        transferOwnershipCall,
    );
    // Save addresses of deployed PoCo contracts for later use
    saveDeployedAddress('ERC1538Proxy', erc1538ProxyAddress);
    const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${erc1538.address}`);
    // Deploy library & modules
    const iexecLibOrdersAddress = await factoryDeployer.deployWithFactory(
        new IexecLibOrders_v5__factory(),
    );
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const modules = [
        new ERC1538QueryDelegate__factory(),
        new IexecAccessorsDelegate__factory(),
        new IexecAccessorsABILegacyDelegate__factory(),
        new IexecCategoryManagerDelegate__factory(),
        new IexecERC20Delegate__factory(),
        isTokenMode
            ? new IexecEscrowTokenDelegate__factory()
            : new IexecEscrowNativeDelegate__factory(),
        new IexecMaintenanceDelegate__factory(iexecLibOrders),
        new IexecOrderManagementDelegate__factory(iexecLibOrders),
        new IexecPoco1Delegate__factory(iexecLibOrders),
        new IexecPoco2Delegate__factory(),
        new IexecRelayDelegate__factory(),
        new ENSIntegrationDelegate__factory(),
        new IexecMaintenanceExtraDelegate__factory(),
        new IexecPocoAccessorsDelegate__factory(iexecLibOrders),
        new IexecPocoBoostDelegate__factory(iexecLibOrders),
        new IexecPocoBoostAccessorsDelegate__factory(),
    ];
    for (const module of modules) {
        const address = await factoryDeployer.deployWithFactory(module);
        await linkContractToProxy(erc1538, address, module);
    }
    // Verify linking on ERC1538Proxy
    const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        erc1538ProxyAddress,
        owner,
    );
    const functionCount = await erc1538QueryInstance.totalFunctions();
    console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
    for (let i = 0; i < functionCount.toNumber(); i++) {
        const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
        console.log(`[${i}] ${contract} ${method}`);
    }
    const appRegistryAddress = await factoryDeployer.deployWithFactory(
        new AppRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const datasetRegistryAddress = await factoryDeployer.deployWithFactory(
        new DatasetRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const workerpoolRegistryAddress = await factoryDeployer.deployWithFactory(
        new WorkerpoolRegistry__factory(),
        [],
        transferOwnershipCall,
    );

    const appRegistryInstance = AppRegistry__factory.connect(appRegistryAddress, owner);
    const datasetRegistryInstance = DatasetRegistry__factory.connect(datasetRegistryAddress, owner);
    const workerpoolRegistryInstance = WorkerpoolRegistry__factory.connect(
        workerpoolRegistryAddress,
        owner,
    );
    // Base URI configuration from config.json
    const baseURIApp = CONFIG.registriesBaseUri.app || 'https://default.app.url/';
    const baseURIDataset = CONFIG.registriesBaseUri.dataset || 'https://default.dataset.url/';
    const baseURIWorkerpool =
        CONFIG.registriesBaseUri.workerpool || 'https://default.workerpool.url/';
    // Check if registries have been initialized and set base URIs
    if (!(await appRegistryInstance.initialized())) {
        await appRegistryInstance
            .initialize(deploymentOptions.v3.AppRegistry || ethers.constants.AddressZero)
            .then((tx) => tx.wait());
        await appRegistryInstance.setBaseURI(`${baseURIApp}${chainId}/`).then((tx) => tx.wait());
    }
    if (!(await datasetRegistryInstance.initialized())) {
        await datasetRegistryInstance
            .initialize(deploymentOptions.v3.DatasetRegistry || ethers.constants.AddressZero)
            .then((tx) => tx.wait());
        await datasetRegistryInstance
            .setBaseURI(`${baseURIDataset}${chainId}/`)
            .then((tx) => tx.wait());
    }
    if (!(await workerpoolRegistryInstance.initialized())) {
        await workerpoolRegistryInstance
            .initialize(deploymentOptions.v3.WorkerpoolRegistry || ethers.constants.AddressZero)
            .then((tx) => tx.wait());
        await workerpoolRegistryInstance
            .setBaseURI(`${baseURIWorkerpool}${chainId}/`)
            .then((tx) => tx.wait());
    }

    // Set main configuration
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const iexecInitialized =
        (await iexecAccessorsInstance.eip712domain_separator()) != ethers.constants.HashZero;
    if (!iexecInitialized) {
        await IexecMaintenanceDelegate__factory.connect(erc1538ProxyAddress, owner)
            .configure(
                rlcInstanceAddress,
                'Staked RLC',
                'SRLC',
                9, // TODO: generic ?
                appRegistryAddress,
                datasetRegistryAddress,
                workerpoolRegistryAddress,
                ethers.constants.AddressZero,
            )
            .then((tx) => tx.wait());
    }
    // Set categories
    const catCountBefore = await iexecAccessorsInstance.countCategory();
    const categories = CONFIG.categories as Category[];
    for (let i = catCountBefore.toNumber(); i < categories.length; i++) {
        const category = categories[i];
        await IexecCategoryManager__factory.connect(erc1538ProxyAddress, owner)
            .createCategory(
                category.name,
                JSON.stringify(category.description),
                category.workClockTimeRef,
            )
            .then((tx) => tx.wait());
    }
    const catCountAfter = await iexecAccessorsInstance.countCategory();
    console.log(`countCategory is now: ${catCountAfter} (was ${catCountBefore})`);
    for (let i = 0; i < catCountAfter.toNumber(); i++) {
        console.log(`Category ${i}: ${await iexecAccessorsInstance.viewCategory(i)}`);
    }
};

async function getOrDeployRlc(token: string, owner: SignerWithAddress) {
    return token // token
        ? token
        : await new RLC__factory()
              .connect(owner)
              .deploy()
              .then((contract) => {
                  contract.deployed();
                  return contract.address;
              });
}

/**
 * Link a contract to an ERC1538 proxy.
 * @param proxy contract to ERC1538 proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
async function linkContractToProxy(
    proxy: ERC1538Update,
    contractAddress: string,
    contractFactory: any,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    await proxy
        .updateContract(
            contractAddress,
            // TODO: Use contractFactory.interface.functions when moving to ethers@v6
            // https://github.com/ethers-io/ethers.js/issues/1069
            getFunctionSignatures(contractFactory.constructor.abi),
            'Linking ' + contractName,
        )
        .then((tx) => tx.wait())
        .catch(() => {
            throw new Error(`Failed to link ${contractName}`);
        });
}

// TODO [optional]: Use hardhat-deploy to save addresses automatically
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
/**
 * Save addresses of deployed contracts (since hardhat does not do it for us).
 * @param contractName contract name to deploy
 * @param deployedAddress address where contract where deployed
 */
function saveDeployedAddress(contractName: string, deployedAddress: string) {
    const chainId = hre.network.config.chainId || 0;
    const BUILD_DIR = '../build';
    fs.writeFileSync(
        path.resolve(__dirname, BUILD_DIR, `${contractName}.json`),
        JSON.stringify({
            networks: {
                [chainId]: {
                    address: deployedAddress,
                },
            },
        }),
    );
    console.log(`Saved deployment at ${deployedAddress} for ${contractName}`);
}

module.exports.tags = ['IexecPocoBoostDelegate'];
