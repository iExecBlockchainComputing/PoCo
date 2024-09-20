import { deployments, ethers } from 'hardhat';
import CONFIG from '../../config/config.json';
import {
    GenericFactory__factory,
    IexecOrderManagementDelegate__factory,
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
} from '../../typechain';
const genericFactoryAddress = require('@amxx/factory/deployments/GenericFactory.json').address;

if (process.env.SKIP_MAIN != 'true') {
    (async () => {
        await deployModules();
    })();
}

export async function deployModules() {
    console.log('Deploying modules..');
    const [owner] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;

    const salt = deploymentOptions.salt;

    const modules = [
        {
            name: 'IexecOrderManagementDelegate',
            bytecode: IexecOrderManagementDelegate__factory.linkBytecode({
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    deploymentOptions.IexecLibOrders_v5,
            }),
        },
        {
            name: 'IexecPoco1Delegate',
            bytecode: IexecPoco1Delegate__factory.linkBytecode({
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    deploymentOptions.IexecLibOrders_v5,
            }),
        },
        {
            name: 'IexecPoco2Delegate',
            bytecode: IexecPoco2Delegate__factory.bytecode,
        },
        {
            name: 'IexecPocoAccessorsDelegate',
            bytecode: IexecPocoAccessorsDelegate__factory.linkBytecode({
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    deploymentOptions.IexecLibOrders_v5,
            }),
        },
    ];
    const genericFactoryInstance = GenericFactory__factory.connect(genericFactoryAddress, owner);
    for await (const module of modules) {
        const moduleAddress = await genericFactoryInstance.predictAddress(module.bytecode, salt);
        await genericFactoryInstance.createContract(module.bytecode, salt).then((tx) => tx.wait());
        console.log(`${module.name}: ${moduleAddress}`);
        await deployments.save(module.name, {
            abi: [],
            address: moduleAddress,
        });
    }
}
