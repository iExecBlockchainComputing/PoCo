// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress, ZeroHash } from 'ethers';
import { ethers } from 'hardhat';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    ERC1538Update,
    ERC1538UpdateDelegate__factory,
    ERC1538Update__factory,
    IexecAccessors__factory,
    IexecCategoryManager__factory,
    IexecMaintenanceDelegate__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../typechain';
import config from '../utils/config';
import { deploy } from '../utils/deploy-tools';

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
export default async function deployment() {
    console.log('Deploying PoCo..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const privateKey = 'your-private-key';
    if (!privateKey) {
        throw new Error('Please set PRIVATE_KEY in your environment variables');
    }

    // Create a wallet from the private key
    const wallet = new ethers.Wallet(privateKey);
    const owner = wallet.connect(ethers.provider) as unknown as SignerWithAddress;
    console.log(`Deploying with address: ${owner.address}`);

    const deploymentOptions = config.getChainConfigOrDefault(chainId);
    // Deploy RLC
    const isTokenMode = !config.isNativeChain(deploymentOptions);
    // let rlcInstanceAddress = await getOrDeployRlc(deploymentOptions.token!, owner) // token
    let rlcInstanceAddress = '0xD292e4e0b5b4b7A151E1F8144Ea8C67116217fA4'; // token
    console.log(`RLC: ${rlcInstanceAddress}`);
    // Deploy ERC1538 proxy contracts
    const erc1538UpdateAddress = await deploy(new ERC1538UpdateDelegate__factory(), owner);

    // const erc1538ProxyAddress = await (await deploy(
    //     new ERC1538Proxy__factory(),
    //     owner,
    //     [erc1538UpdateAddress],
    //     //transferOwnershipCall,
    // )).getAddress();
    const erc1538ProxyAddress = '0xC7e170b0a96131CC6368bF38a96D5EDDdAdfA711';
    const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${await erc1538.getAddress()}`);
    // Deploy library & modules
    // const iexecLibOrdersAddress = await deploy(new IexecLibOrders_v5__factory(), owner);
    const iexecLibOrdersAddress = '0x7008002c9baA8b6023C0F235cbFa8eFfDf457D02';
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const modules = [
        // new ERC1538QueryDelegate__factory(),
        // new IexecAccessorsDelegate__factory(),
        // new IexecAccessorsABILegacyDelegate__factory(),
        // new IexecCategoryManagerDelegate__factory(),
        // new IexecERC20Delegate__factory(),
        // isTokenMode
        //     ? new IexecEscrowTokenDelegate__factory()
        //     : new IexecEscrowNativeDelegate__factory(),
        // new IexecMaintenanceDelegate__factory(iexecLibOrders),
        // new IexecOrderManagementDelegate__factory(iexecLibOrders),
        // new IexecPoco1Delegate__factory(iexecLibOrders),
        // new IexecPoco2Delegate__factory(),
        // new IexecRelayDelegate__factory(),
        // new ENSIntegrationDelegate__factory(),
        // new IexecMaintenanceExtraDelegate__factory(),
        // new IexecPocoAccessorsDelegate__factory(iexecLibOrders),
        // new IexecPocoBoostDelegate__factory(iexecLibOrders),
        // new IexecPocoBoostAccessorsDelegate__factory(),
    ];
    // for (const module of modules) {
    //     const address = await (await deploy(module, owner)).getAddress();
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
    const appRegistryAddress = await (
        await deploy(
            new AppRegistry__factory(),
            owner,
            // [],
            // transferOwnershipCall,
        )
    ).getAddress();
    const datasetRegistryAddress = await (
        await deploy(
            new DatasetRegistry__factory(),
            owner,
            // [],
            // transferOwnershipCall,
        )
    ).getAddress();
    const workerpoolRegistryAddress = await (
        await deploy(
            new WorkerpoolRegistry__factory(),
            owner,
            // [],
            // transferOwnershipCall,
        )
    ).getAddress();

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
