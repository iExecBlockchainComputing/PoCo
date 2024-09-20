import { BigNumber } from '@ethersproject/bignumber';
import { BytesLike } from '@ethersproject/bytes';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import CONFIG from '../../config/config.json';
import {
    IexecOrderManagementDelegate__factory,
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
    Ownable__factory,
    TimelockController__factory,
} from '../../typechain';
import {
    encodeModuleProxyUpdate,
    logTxData,
    printBlockTime,
    printFunctions,
} from '../upgrades/upgrade-helper';

if (process.env.SKIP_MAIN != 'true') {
    (async () => {
        await addModulesToProxy();
    })();
}

export async function addModulesToProxy() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;
    console.log('Link functions to proxy:');
    const erc1538ProxyAddress = deploymentOptions.ERC1538Proxy;
    const iexecOrderManagementAddress = (await hre.deployments.get('IexecOrderManagementDelegate'))
        .address;
    const iexecPoco1DelegateAddress = (await hre.deployments.get('IexecPoco1Delegate')).address;
    const iexecPoco2DelegateAddress = (await hre.deployments.get('IexecPoco2Delegate')).address;
    const iexecPocoAccessorsDelegateAddress = (
        await hre.deployments.get('IexecPocoAccessorsDelegate')
    ).address;
    await printFunctions(erc1538ProxyAddress);

    console.log('Functions about to be added to proxy:');
    const timelockAddress = await Ownable__factory.connect(
        erc1538ProxyAddress,
        ethers.provider,
    ).owner();
    const iexecOrderManagementProxyUpdate = encodeModuleProxyUpdate(
        IexecOrderManagementDelegate__factory.createInterface(),
        iexecOrderManagementAddress,
    );
    const iexecPoco1ProxyUpdate = encodeModuleProxyUpdate(
        IexecPoco1Delegate__factory.createInterface(),
        iexecPoco1DelegateAddress,
    );
    const iexecPoco2ProxyUpdate = encodeModuleProxyUpdate(
        IexecPoco2Delegate__factory.createInterface(),
        iexecPoco2DelegateAddress,
    );
    const iexecPocoAccessorsProxyUpdate = encodeModuleProxyUpdate(
        IexecPocoAccessorsDelegate__factory.createInterface(),
        iexecPocoAccessorsDelegateAddress,
    );
    // The salt must be the same for a given schedule & execute operation set
    // Please increment salt in case of operation ID collision
    const operationSalt = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const updates = [
        iexecOrderManagementProxyUpdate,
        iexecPoco1ProxyUpdate,
        iexecPoco2ProxyUpdate,
        iexecPocoAccessorsProxyUpdate,
    ];
    const updateProxyArgs = [
        Array(updates.length).fill(erc1538ProxyAddress),
        Array(updates.length).fill(0),
        updates,
        ethers.constants.HashZero,
        operationSalt,
    ] as [string[], BigNumber[], BytesLike[], BytesLike, BytesLike];
    console.log('Scheduling proxy update..');
    await printBlockTime();
    const timelockInstance = TimelockController__factory.connect(timelockAddress, ethers.provider);
    const delay = await timelockInstance.getMinDelay();
    const timelockAdminAddress = await timelockInstance.getRoleMember(
        await timelockInstance.PROPOSER_ROLE(),
        0,
    );
    console.log(`Timelock proposer: ${timelockAdminAddress}`);
    const timelockAdminSigner = await ethers.getImpersonatedSigner(timelockAdminAddress);
    await timelockInstance
        .connect(timelockAdminSigner)
        .scheduleBatch(...updateProxyArgs, delay)
        .then((tx) => {
            logTxData(tx);
            tx.wait();
        });
    await time.increase(delay);
    console.log('Time traveling..');
    await printBlockTime();
    await printFunctions(erc1538ProxyAddress);
    console.log('Executing proxy update..');
    await timelockInstance
        .connect(timelockAdminSigner)
        .executeBatch(...updateProxyArgs)
        .then((x) => {
            logTxData(x);
            x.wait();
        });
    await printFunctions(erc1538ProxyAddress);
    return erc1538ProxyAddress;
}
