// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
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
import { Category } from '../utils/poco-tools';
import { linkContractToProxy } from '../utils/proxy-tools';
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
export default async function deploy() {
    console.log('Deploying PoCo..');
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const [owner] = await ethers.getSigners();
    const deploymentOptions = CONFIG.chains[chainId] || CONFIG.chains.default;
    const salt = process.env.SALT || deploymentOptions.v5.salt || ethers.ZeroHash;
    const factoryDeployer = new FactoryDeployerHelper(owner, salt);
    // Deploy RLC
    const isTokenMode = deploymentOptions.asset == 'Token';
    let rlcInstanceAddress = isTokenMode
        ? await getOrDeployRlc(deploymentOptions.token, owner) // token
        : ethers.ZeroAddress; // native
    console.log(`RLC: ${rlcInstanceAddress}`);
    // Deploy ERC1538 proxy contracts
    const erc1538UpdateAddress = await factoryDeployer.deployWithFactory(
        new ERC1538UpdateDelegate__factory(),
    );
    const transferOwnershipCall = await Ownable__factory.connect(
        ethers.ZeroAddress, // any is fine
        owner, // any is fine
    )
        .transferOwnership.populateTransaction(owner.address)
        .then((tx) => tx.data)
        .catch(() => {
            throw new Error('Failed to prepare transferOwnership data');
        });
    const erc1538ProxyAddress = await factoryDeployer.deployWithFactory(
        new ERC1538Proxy__factory(),
        [erc1538UpdateAddress],
        transferOwnershipCall,
    );
    const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${await erc1538.getAddress()}`);
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
    for (let i = 0; i < Number(functionCount); i++) {
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
    const baseURIApp = CONFIG.registriesBaseUri.app;
    const baseURIDataset = CONFIG.registriesBaseUri.dataset;
    const baseURIWorkerpool = CONFIG.registriesBaseUri.workerpool;
    // Check if registries have been initialized and set base URIs
    if (!(await appRegistryInstance.initialized())) {
        await appRegistryInstance
            .initialize(deploymentOptions.v3.AppRegistry || ethers.ZeroAddress)
            .then((tx) => tx.wait());
        await appRegistryInstance.setBaseURI(`${baseURIApp}/${chainId}/`).then((tx) => tx.wait());
    }
    if (!(await datasetRegistryInstance.initialized())) {
        await datasetRegistryInstance
            .initialize(deploymentOptions.v3.DatasetRegistry || ethers.ZeroAddress)
            .then((tx) => tx.wait());
        await datasetRegistryInstance
            .setBaseURI(`${baseURIDataset}/${chainId}/`)
            .then((tx) => tx.wait());
    }
    if (!(await workerpoolRegistryInstance.initialized())) {
        await workerpoolRegistryInstance
            .initialize(deploymentOptions.v3.WorkerpoolRegistry || ethers.ZeroAddress)
            .then((tx) => tx.wait());
        await workerpoolRegistryInstance
            .setBaseURI(`${baseURIWorkerpool}/${chainId}/`)
            .then((tx) => tx.wait());
    }

    // Set main configuration
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const iexecInitialized =
        (await iexecAccessorsInstance.eip712domain_separator()) != ethers.ZeroHash;
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
                ethers.ZeroAddress,
            )
            .then((tx) => tx.wait());
    }
    // Set categories
    const catCountBefore = await iexecAccessorsInstance.countCategory();
    const categories = CONFIG.categories as Category[];
    for (let i = Number(catCountBefore); i < categories.length; i++) {
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
    for (let i = 0; i < Number(catCountAfter); i++) {
        console.log(`Category ${i}: ${await iexecAccessorsInstance.viewCategory(i)}`);
    }
}

async function getOrDeployRlc(token: string, owner: SignerWithAddress) {
    return token // token
        ? token
        : await new RLC__factory()
              .connect(owner)
              .deploy()
              .then((contract) => contract.waitForDeployment())
              .then((contract) => contract.getAddress());
}
