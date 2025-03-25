// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress, ZeroHash } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    DiamondCutFacet,
    DiamondCutFacet__factory,
    DiamondInit__factory,
    DiamondLoupeFacet,
    DiamondLoupeFacet__factory,
    Diamond__factory,
    ENSIntegrationDelegate__factory,
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
    LibDiamond__factory,
    OwnershipFacet__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../typechain';
import { Ownable__factory } from '../typechain/factories/@openzeppelin/contracts/access';
import { FactoryDeployer } from '../utils/FactoryDeployer';
import config from '../utils/config';
import { linkContractToProxy } from '../utils/proxy-tools';

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
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await ethers.getSigners();
    const deploymentOptions = config.getChainConfigOrDefault(chainId);
    const salt = process.env.SALT || deploymentOptions.v5.salt || ethers.ZeroHash;
    const factoryDeployer = new FactoryDeployer(owner, salt);
    // Deploy RLC
    const isTokenMode = !config.isNativeChain(deploymentOptions);
    let rlcInstanceAddress = isTokenMode
        ? await getOrDeployRlc(deploymentOptions.token!, owner) // token
        : ZeroAddress; // native
    console.log(`RLC: ${rlcInstanceAddress}`);
    // TODO: Rename 1538 to 2535 everywhere
    // Deploy ERC1538 proxy contracts
    const libDiamondAddress = await factoryDeployer.deployWithFactory(new LibDiamond__factory());
    const libDiamond = (hre as any).__SOLIDITY_COVERAGE_RUNNING
        ? {
              ['@mudgen/diamond/contracts/libraries/LibDiamond.sol:LibDiamond']: libDiamondAddress,
          }
        : {};
    const erc1538UpdateAddress = await factoryDeployer.deployWithFactory(
        new DiamondCutFacet__factory(libDiamond),
    );
    const transferOwnershipCall = await Ownable__factory.connect(
        ZeroAddress, // any is fine
        owner, // any is fine
    )
        .transferOwnership.populateTransaction(owner.address)
        .then((tx) => tx.data)
        .catch(() => {
            throw new Error('Failed to prepare transferOwnership data');
        });
    const erc1538ProxyAddress = await factoryDeployer.deployWithFactory(
        new Diamond__factory(libDiamond),
        [owner.address, erc1538UpdateAddress],
    );
    const erc1538: DiamondCutFacet = DiamondCutFacet__factory.connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${await erc1538.getAddress()}`);
    const diamondInitAddress = await factoryDeployer.deployWithFactory(new DiamondInit__factory());
    // Deploy library & modules
    const iexecLibOrdersAddress = await factoryDeployer.deployWithFactory(
        new IexecLibOrders_v5__factory(),
    );
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const modules = [
        new DiamondLoupeFacet__factory(),
        new OwnershipFacet__factory(libDiamond),
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
        await linkContractToProxy(erc1538, diamondInitAddress, address, module);
    }
    // Verify linking on ERC1538Proxy
    const erc1538QueryInstance: DiamondLoupeFacet = DiamondLoupeFacet__factory.connect(
        erc1538ProxyAddress,
        owner,
    );
    const facets = await erc1538QueryInstance.facets();
    const functionCount = facets
        .map((facet) => facet.functionSelectors.length)
        .reduce((acc, curr) => acc + curr, 1);
    console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
    for (let i = 0; i < Number(functionCount); i++) {
        // const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
        // console.log(`[${i}] ${contract} ${method}`);
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
    const baseURIApp = config.registriesBaseUri.app;
    const baseURIDataset = config.registriesBaseUri.dataset;
    const baseURIWorkerpool = config.registriesBaseUri.workerpool;
    // Check if registries have been initialized and set base URIs
    if (!(await appRegistryInstance.initialized())) {
        await appRegistryInstance
            .initialize(deploymentOptions.v3.AppRegistry || ZeroAddress)
            .then((tx) => tx.wait());
        await appRegistryInstance.setBaseURI(`${baseURIApp}/${chainId}/`).then((tx) => tx.wait());
    }
    if (!(await datasetRegistryInstance.initialized())) {
        await datasetRegistryInstance
            .initialize(deploymentOptions.v3.DatasetRegistry || ZeroAddress)
            .then((tx) => tx.wait());
        await datasetRegistryInstance
            .setBaseURI(`${baseURIDataset}/${chainId}/`)
            .then((tx) => tx.wait());
    }
    if (!(await workerpoolRegistryInstance.initialized())) {
        await workerpoolRegistryInstance
            .initialize(deploymentOptions.v3.WorkerpoolRegistry || ZeroAddress)
            .then((tx) => tx.wait());
        await workerpoolRegistryInstance
            .setBaseURI(`${baseURIWorkerpool}/${chainId}/`)
            .then((tx) => tx.wait());
    }

    // Set main configuration
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const iexecInitialized = (await iexecAccessorsInstance.eip712domain_separator()) != ZeroHash;
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
                ZeroAddress,
            )
            .then((tx) => tx.wait());
    }
    // Set categories
    const catCountBefore = await iexecAccessorsInstance.countCategory();
    for (let i = Number(catCountBefore); i < config.categories.length; i++) {
        const category = config.categories[i];
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
