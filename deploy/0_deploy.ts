// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress, ZeroHash } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { FacetCut, FacetCutAction } from 'hardhat-deploy/dist/types';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    DiamondCutFacet__factory,
    DiamondInit__factory,
    DiamondLoupeFacet,
    DiamondLoupeFacet__factory,
    Diamond__factory,
    IexecAccessorsABILegacyFacet__factory,
    IexecAccessorsFacet__factory,
    IexecAccessors__factory,
    IexecCategoryManagerFacet__factory,
    IexecCategoryManager__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecERC20Facet__factory,
    IexecEscrowNativeFacet__factory,
    IexecEscrowTokenFacet__factory,
    IexecLibOrders_v5__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet__factory,
    IexecRelayFacet__factory,
    OwnershipFacet__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../typechain';
import { DiamondArgsStruct } from '../typechain/contracts/Diamond';
import { Ownable__factory } from '../typechain/factories/@openzeppelin/contracts/access';
import { FactoryDeployer } from '../utils/FactoryDeployer';
import config from '../utils/config';
import { getFunctionSelectors, linkContractToProxy } from '../utils/proxy-tools';
import { getLibDiamondConfigOrEmpty } from '../utils/tools';

let factoryDeployer: FactoryDeployer;

export default async function deploy() {
    console.log('Deploying PoCo..');
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    const [owner] = await ethers.getSigners();
    const deploymentOptions = config.getChainConfigOrDefault(chainId);
    factoryDeployer = new FactoryDeployer(owner, chainId);
    // Deploy RLC
    const isTokenMode = !config.isNativeChain(deploymentOptions);
    let rlcInstanceAddress = isTokenMode
        ? await getOrDeployRlc(deploymentOptions.token!, owner) // token
        : ZeroAddress; // native
    console.log(`RLC: ${rlcInstanceAddress}`);
    /**
     * Deploy proxy and facets.
     */
    // TODO put inside init() function.
    const transferOwnershipCall = await Ownable__factory.connect(
        ZeroAddress, // any is fine
        owner, // any is fine
    )
        .transferOwnership.populateTransaction(owner.address)
        .then((tx) => tx.data)
        .catch(() => {
            throw new Error('Failed to prepare transferOwnership data');
        });
    const diamondProxyAddress = await deployDiamondProxyWithDefaultFacets(
        owner,
        // transferOwnershipCall, //TODO
    );
    const diamond = DiamondCutFacet__factory.connect(diamondProxyAddress, owner);
    console.log(`IexecInstance found at address: ${await diamond.getAddress()}`);
    // Deploy library & modules
    const iexecLibOrdersAddress = await factoryDeployer.deployContract(
        new IexecLibOrders_v5__factory(),
    );
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const modules = [
        new IexecAccessorsFacet__factory(),
        new IexecAccessorsABILegacyFacet__factory(),
        new IexecCategoryManagerFacet__factory(),
        new IexecERC20Facet__factory(),
        isTokenMode ? new IexecEscrowTokenFacet__factory() : new IexecEscrowNativeFacet__factory(),
        new IexecConfigurationFacet__factory(iexecLibOrders),
        new IexecOrderManagementFacet__factory(iexecLibOrders),
        new IexecPoco1Facet__factory(iexecLibOrders),
        new IexecPoco2Facet__factory(),
        new IexecRelayFacet__factory(),
        new IexecConfigurationExtraFacet__factory(),
        new IexecPocoAccessorsFacet__factory(iexecLibOrders),
        new IexecPocoBoostFacet__factory(iexecLibOrders),
        new IexecPocoBoostAccessorsFacet__factory(),
    ];
    for (const module of modules) {
        const address = await factoryDeployer.deployContract(module);
        await linkContractToProxy(diamond, address, module);
    }
    // Verify linking on Diamond Proxy
    const diamondLoupeFacetInstance: DiamondLoupeFacet = DiamondLoupeFacet__factory.connect(
        diamondProxyAddress,
        owner,
    );
    const facets = await diamondLoupeFacetInstance.facets();
    const functionCount = facets
        .map((facet) => facet.functionSelectors.length)
        .reduce((acc, curr) => acc + curr, 0);
    console.log(`The deployed Diamond Proxy now supports ${functionCount} functions:`);
    // TODO
    // for (let i = 0; i < Number(functionCount); i++) {
    //     const [method, , contract] = await diamondLoupeFacetInstance.functionByIndex(i);
    //     console.log(`[${i}] ${contract} ${method}`);
    // }
    /**
     * Deploy registries and link them to the proxy.
     */
    const appRegistryAddress = await factoryDeployer.deployContract(
        new AppRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const datasetRegistryAddress = await factoryDeployer.deployContract(
        new DatasetRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const workerpoolRegistryAddress = await factoryDeployer.deployContract(
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
    const iexecAccessorsInstance = IexecAccessors__factory.connect(diamondProxyAddress, owner);
    const iexecInitialized = (await iexecAccessorsInstance.eip712domain_separator()) != ZeroHash;
    if (!iexecInitialized) {
        // TODO replace this with DiamondInit.init().
        await IexecConfigurationFacet__factory.connect(diamondProxyAddress, owner)
            .configure(
                rlcInstanceAddress,
                'Staked RLC',
                'SRLC',
                9,
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
        await IexecCategoryManager__factory.connect(diamondProxyAddress, owner)
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

/**
 * Deploys and initializes a Diamond proxy contract with default facets.
 * @returns The address of the deployed Diamond proxy contract.
 */
async function deployDiamondProxyWithDefaultFacets(
    owner: SignerWithAddress,
    // transferOwnershipCall: string, // TODO
): Promise<string> {
    const initAddress = await factoryDeployer.deployContract(new DiamondInit__factory());
    const initCalldata = DiamondInit__factory.createInterface().encodeFunctionData('init');
    const libDiamondConfig = await getLibDiamondConfigOrEmpty(owner);
    // Deploy required proxy facets.
    const facetFactories = [
        new DiamondCutFacet__factory(libDiamondConfig),
        new DiamondLoupeFacet__factory(),
        new OwnershipFacet__factory(libDiamondConfig),
    ];
    const facetCuts: FacetCut[] = [];
    for (let i = 0; i < facetFactories.length; i++) {
        const facetFactory = facetFactories[i];
        const facetAddress = await factoryDeployer.deployContract(facetFactory);
        facetCuts.push({
            facetAddress: facetAddress,
            action: FacetCutAction.Add,
            functionSelectors: getFunctionSelectors(facetFactory),
        });
    }
    // Set diamond constructor arguments
    const diamondArgs: DiamondArgsStruct = {
        owner: owner.address,
        init: initAddress,
        initCalldata: initCalldata,
    };
    return await factoryDeployer.deployContract(
        new Diamond__factory(libDiamondConfig),
        [facetCuts, diamondArgs],
        // transferOwnershipCall, // TODO
    );
}
