// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress, ZeroHash } from 'ethers';
import { deployments, ethers } from 'hardhat';
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
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    const [owner] = await ethers.getSigners();
    const deploymentOptions = config.getChainConfigOrDefault(chainId);
    const factoryDeployer = new FactoryDeployer(owner, chainId);
    // // Deploy RLC
    // const isTokenMode = !config.isNativeChain(deploymentOptions);
    // let rlcInstanceAddress = isTokenMode
    //     ? await getOrDeployRlc(deploymentOptions.token!, owner) // token
    //     : ZeroAddress; // native
    // console.log(`RLC: ${rlcInstanceAddress}`);
    // Deploy ERC1538 proxy contracts
    const erc1538UpdateAddress = await factoryDeployer.deployContract(
        new ERC1538UpdateDelegate__factory(),
    );
    // const transferOwnershipCall = await Ownable__factory.connect(
    //     ZeroAddress, // any is fine
    //     owner, // any is fine
    // )
    //     .transferOwnership.populateTransaction(owner.address)
    //     .then((tx) => tx.data)
    //     .catch(() => {
    //         throw new Error('Failed to prepare transferOwnership data');
    //     });
    // const erc1538ProxyAddress = await factoryDeployer.deployContract(
    //     new ERC1538Proxy__factory(),
    //     [erc1538UpdateAddress],
    //     transferOwnershipCall,
    // );
    // const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
    // console.log(`IexecInstance found at address: ${await erc1538.getAddress()}`);
    // // Deploy library & modules
    // const iexecLibOrdersAddress = await factoryDeployer.deployContract(
    //     new IexecLibOrders_v5__factory(),
    // );
    // const iexecLibOrders = {
    //     ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    // };
    // const modules = [
    //     new ERC1538QueryDelegate__factory(),
    //     new IexecAccessorsDelegate__factory(),
    //     new IexecAccessorsABILegacyDelegate__factory(),
    //     new IexecCategoryManagerDelegate__factory(),
    //     new IexecERC20Delegate__factory(),
    //     isTokenMode
    //         ? new IexecEscrowTokenDelegate__factory()
    //         : new IexecEscrowNativeDelegate__factory(),
    //     new IexecMaintenanceDelegate__factory(iexecLibOrders),
    //     new IexecOrderManagementDelegate__factory(iexecLibOrders),
    //     new IexecPoco1Delegate__factory(iexecLibOrders),
    //     new IexecPoco2Delegate__factory(),
    //     new IexecRelayDelegate__factory(),
    //     new ENSIntegrationDelegate__factory(),
    //     new IexecMaintenanceExtraDelegate__factory(),
    //     new IexecPocoAccessorsDelegate__factory(iexecLibOrders),
    //     new IexecPocoBoostDelegate__factory(iexecLibOrders),
    //     new IexecPocoBoostAccessorsDelegate__factory(),
    // ];
    // for (const module of modules) {
    //     const address = await factoryDeployer.deployContract(module);
    //     await linkContractToProxy(erc1538, address, module);
    // }
    // // Verify linking on ERC1538Proxy
    // const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
    //     erc1538ProxyAddress,
    //     owner,
    // );
    // const functionCount = await erc1538QueryInstance.totalFunctions();
    // console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
    // for (let i = 0; i < Number(functionCount); i++) {
    //     const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
    //     console.log(`[${i}] ${contract} ${method}`);
    // }
    // const appRegistryAddress = await factoryDeployer.deployContract(
    //     new AppRegistry__factory(),
    //     [],
    //     transferOwnershipCall,
    // );
    // const datasetRegistryAddress = await factoryDeployer.deployContract(
    //     new DatasetRegistry__factory(),
    //     [],
    //     transferOwnershipCall,
    // );
    // const workerpoolRegistryAddress = await factoryDeployer.deployContract(
    //     new WorkerpoolRegistry__factory(),
    //     [],
    //     transferOwnershipCall,
    // );

    // const appRegistryInstance = AppRegistry__factory.connect(appRegistryAddress, owner);
    // const datasetRegistryInstance = DatasetRegistry__factory.connect(datasetRegistryAddress, owner);
    // const workerpoolRegistryInstance = WorkerpoolRegistry__factory.connect(
    //     workerpoolRegistryAddress,
    //     owner,
    // );
    // // Base URI configuration from config.json
    // const baseURIApp = config.registriesBaseUri.app;
    // const baseURIDataset = config.registriesBaseUri.dataset;
    // const baseURIWorkerpool = config.registriesBaseUri.workerpool;
    // // Check if registries have been initialized and set base URIs
    // if (!(await appRegistryInstance.initialized())) {
    //     await appRegistryInstance
    //         .initialize(deploymentOptions.v3.AppRegistry || ZeroAddress)
    //         .then((tx) => tx.wait());
    //     await appRegistryInstance.setBaseURI(`${baseURIApp}/${chainId}/`).then((tx) => tx.wait());
    // }
    // if (!(await datasetRegistryInstance.initialized())) {
    //     await datasetRegistryInstance
    //         .initialize(deploymentOptions.v3.DatasetRegistry || ZeroAddress)
    //         .then((tx) => tx.wait());
    //     await datasetRegistryInstance
    //         .setBaseURI(`${baseURIDataset}/${chainId}/`)
    //         .then((tx) => tx.wait());
    // }
    // if (!(await workerpoolRegistryInstance.initialized())) {
    //     await workerpoolRegistryInstance
    //         .initialize(deploymentOptions.v3.WorkerpoolRegistry || ZeroAddress)
    //         .then((tx) => tx.wait());
    //     await workerpoolRegistryInstance
    //         .setBaseURI(`${baseURIWorkerpool}/${chainId}/`)
    //         .then((tx) => tx.wait());
    // }

    // // Set main configuration
    // const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    // const iexecInitialized = (await iexecAccessorsInstance.eip712domain_separator()) != ZeroHash;
    // if (!iexecInitialized) {
    //     await IexecMaintenanceDelegate__factory.connect(erc1538ProxyAddress, owner)
    //         .configure(
    //             rlcInstanceAddress,
    //             'Staked RLC',
    //             'SRLC',
    //             9, // TODO: generic ?
    //             appRegistryAddress,
    //             datasetRegistryAddress,
    //             workerpoolRegistryAddress,
    //             ZeroAddress,
    //         )
    //         .then((tx) => tx.wait());
    // }
    // // Set categories
    // const catCountBefore = await iexecAccessorsInstance.countCategory();
    // for (let i = Number(catCountBefore); i < config.categories.length; i++) {
    //     const category = config.categories[i];
    //     await IexecCategoryManager__factory.connect(erc1538ProxyAddress, owner)
    //         .createCategory(
    //             category.name,
    //             JSON.stringify(category.description),
    //             category.workClockTimeRef,
    //         )
    //         .then((tx) => tx.wait());
    // }
    // const catCountAfter = await iexecAccessorsInstance.countCategory();
    // console.log(`countCategory is now: ${catCountAfter} (was ${catCountBefore})`);
    // for (let i = 0; i < Number(catCountAfter); i++) {
    //     console.log(`Category ${i}: ${await iexecAccessorsInstance.viewCategory(i)}`);
    // }

    if (network.name !== 'hardhat' && network.name !== 'localhost') {
        console.log('Waiting for block explorer to index the contracts...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
        await import('../scripts/verify').then((module) => module.default());
    }
}

async function getOrDeployRlc(token: string, owner: SignerWithAddress) {
    const rlcFactory = new RLC__factory().connect(owner);
    let rlcAddress: string;

    if (token) {
        console.log(`Using existing RLC token at: ${token}`);
        rlcAddress = token;
    } else {
        console.log('Deploying new RLC token...');
        rlcAddress = await rlcFactory
            .deploy()
            .then((contract) => contract.waitForDeployment())
            .then((contract) => contract.getAddress());
        console.log(`New RLC token deployed at: ${rlcAddress}`);
    }

    await deployments.save('RLC', {
        abi: (rlcFactory as any).constructor.abi,
        address: rlcAddress,
        bytecode: (await rlcFactory.getDeployTransaction()).data,
        deployedBytecode: await ethers.provider.getCode(rlcAddress),
    });
    return rlcAddress;
}
