// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers, getNamedAccounts } from 'hardhat';
import {
    GenericFactory__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../typechain';
import config from '../../utils/config';
const genericFactoryAddress = require('@amxx/factory/deployments/GenericFactory.json').address;

if (process.env.HANDLE_SPONSORING_UPGRADE_INTERNALLY != 'true') {
    (async () => {
        await deployModules();
    })();
}

export async function deployModules() {
    console.log('Deploying modules..');
    const { deployer: deployerAddress } = await getNamedAccounts();
    const deployer = await ethers.getSigner(deployerAddress);
    console.log(`Deployer: ${deployer.address}`);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    const salt = deploymentOptions.salt;
    const libraries = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };
    const modules = [
        {
            name: 'IexecOrderManagementFacet',
            contract: new IexecOrderManagementFacet__factory(libraries),
        },
        {
            name: 'IexecPoco1Facet',
            contract: new IexecPoco1Facet__factory(libraries),
        },
        {
            name: 'IexecPoco2Facet',
            contract: new IexecPoco2Facet__factory(),
        },
        {
            name: 'IexecPocoAccessorsFacet',
            contract: new IexecPocoAccessorsFacet__factory(libraries),
        },
    ];
    const genericFactoryInstance = GenericFactory__factory.connect(genericFactoryAddress, deployer);
    for await (const module of modules) {
        let moduleBytecode = (await module.contract.getDeployTransaction()).data;
        if (!moduleBytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        const moduleAddress = await genericFactoryInstance.predictAddress(moduleBytecode, salt);
        await genericFactoryInstance.createContract(moduleBytecode, salt).then((tx) => tx.wait());
        console.log(`${module.name}: ${moduleAddress}`);
        await deployments.save(module.name, {
            abi: (module.contract as any).constructor.abi,
            address: moduleAddress,
            bytecode: moduleBytecode.toString(),
        });
    }
}
