// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import {
    IexecPocoDepositAndMatchNativeFacet__factory,
    IexecPocoDepositAndMatchTokenFacet__factory,
} from '../../typechain';
import { FactoryDeployer } from '../../utils/FactoryDeployer';
import config from '../../utils/config';
import { mineBlockIfOnLocalFork } from '../../utils/mine';

(async () => {
    console.log('Deploying DepositAndMatchOrders modules..');
    await mineBlockIfOnLocalFork();
    const [owner] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }

    const factoryDeployer = new FactoryDeployer(owner, chainId);
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    const modules = [
        {
            name: 'IexecPocoDepositAndMatchTokenFacet',
            factory: new IexecPocoDepositAndMatchTokenFacet__factory(iexecLibOrders),
        },
        {
            name: 'IexecPocoDepositAndMatchNativeFacet',
            factory: new IexecPocoDepositAndMatchNativeFacet__factory(iexecLibOrders),
        },
    ];

    for (const module of modules) {
        const moduleAddress = await factoryDeployer.deployContract(module.factory);
        console.log(`${module.name}: ${moduleAddress}`);
        await deployments.save(module.name, {
            abi: module.factory.interface.fragments as any,
            address: moduleAddress,
            bytecode: module.factory.bytecode,
        });
    }
})();
