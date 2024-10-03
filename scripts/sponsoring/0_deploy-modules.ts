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

if (process.env.HANDLE_SPONSORING_UPGRADE_INTERNALLY != 'true') {
    (async () => {
        await deployModules();
    })();
}

export async function deployModules() {
    console.log('Deploying modules..');
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;

    const salt = deploymentOptions.salt;
    const libraries = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };
    const modules = [
        {
            name: 'IexecOrderManagementDelegate',
            contract: new IexecOrderManagementDelegate__factory(libraries),
        },
        {
            name: 'IexecPoco1Delegate',
            contract: new IexecPoco1Delegate__factory(libraries),
        },
        {
            name: 'IexecPoco2Delegate',
            contract: new IexecPoco2Delegate__factory(),
        },
        {
            name: 'IexecPocoAccessorsDelegate',
            contract: new IexecPocoAccessorsDelegate__factory(libraries),
        },
    ];
    const genericFactoryInstance = GenericFactory__factory.connect(genericFactoryAddress, deployer);
    for await (const module of modules) {
        let moduleBytecode = module.contract.getDeployTransaction().data;
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
