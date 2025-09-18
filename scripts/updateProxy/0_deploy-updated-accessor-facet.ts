// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import { IexecPocoAccessorsFacet__factory } from '../../typechain';
import { FactoryDeployer } from '../../utils/FactoryDeployer';
import config from '../../utils/config';
import { mineBlockIfOnLocalFork } from '../../utils/mine';

(async () => {
    console.log('Deploying updated IexecPocoAccessorsFacet...');
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

    const factory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const facetAddress = await factoryDeployer.deployContract(factory);

    console.log(`IexecPocoAccessorsFacet deployed at: ${facetAddress}`);

    // Save deployment for later use
    await deployments.save('IexecPocoAccessorsFacet', {
        abi: factory.interface.fragments as any,
        address: facetAddress,
        bytecode: factory.bytecode,
    });

    console.log('Deployment saved as IexecPocoAccessorsFacet');
})();
