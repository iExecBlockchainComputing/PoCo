// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import {
    GenericFactory__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate__factory,
} from '../../typechain';
import config from '../../utils/config';
import { mineBlockIfOnLocalFork } from '../../utils/mine';
const genericFactoryAddress = require('@amxx/factory/deployments/GenericFactory.json').address;

(async () => {
    console.log('Deploying Boost modules..');
    await mineBlockIfOnLocalFork();
    const [owner] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    const salt = deploymentOptions.salt;
    const modules = [
        {
            name: 'IexecPocoBoostDelegate',
            bytecode: IexecPocoBoostDelegate__factory.linkBytecode({
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    deploymentOptions.IexecLibOrders_v5,
            }),
        },
        {
            name: 'IexecPocoBoostAccessorsDelegate',
            bytecode: IexecPocoBoostAccessorsDelegate__factory.bytecode,
        },
    ];
    const genericFactoryInstance = GenericFactory__factory.connect(genericFactoryAddress, owner);
    for (const module of modules) {
        const moduleAddress = await genericFactoryInstance.predictAddress(module.bytecode, salt);
        await genericFactoryInstance.createContract(module.bytecode, salt).then((tx) => tx.wait());
        console.log(`${module.name}: ${moduleAddress}`);
        await deployments.save(module.name, {
            abi: [],
            address: moduleAddress,
        });
    }
})();
