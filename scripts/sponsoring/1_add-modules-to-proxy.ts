import { BigNumber } from '@ethersproject/bignumber';
import { BytesLike } from '@ethersproject/bytes';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import CONFIG from '../../config/config.json';
import {
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
    TimelockController__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import {
    encodeModuleProxyUpdate,
    logTxData,
    printBlockTime,
    printFunctions,
} from '../upgrades/upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;
    console.log('Link Boost functions to proxy:');
    const erc1538ProxyAddress = deploymentOptions.ERC1538Proxy;
    const iexecPoco1DelegateAddress = (await hre.deployments.get('IexecPoco1Delegate')).address;
    const iexecPoco2DelegateAddress = (await hre.deployments.get('IexecPoco2Delegate')).address;
    const iexecPocoAccessorsDelegateAddress = (
        await hre.deployments.get('IexecPocoAccessorsDelegate')
    ).address;
    const [account] = await hre.ethers.getSigners();
    await printFunctions(erc1538ProxyAddress, account);

    console.log('Functions about to be added to proxy:');
    const timelockAddress = await Ownable__factory.connect(erc1538ProxyAddress, account).owner();
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
    // Salt but must be the same for schedule & execute
    const operationSalt = '0x0be814a62c44af32241a2c964e5680d1b25c783473c6e7875cbc8071770d7ff0'; // Random
    const delay = 60 * 60 * 24 * 7;
    const updates = [iexecPoco1ProxyUpdate, iexecPoco2ProxyUpdate, iexecPocoAccessorsProxyUpdate];
    const updateProxyArgs = [
        Array(updates.length).fill(erc1538ProxyAddress),
        Array(updates.length).fill(0),
        updates,
        ethers.constants.HashZero,
        operationSalt,
    ] as [string[], BigNumber[], BytesLike[], BytesLike, BytesLike];
    console.log('Scheduling proxy update..');
    await printBlockTime();
    const timelockInstance = TimelockController__factory.connect(timelockAddress, account);
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
    await printFunctions(erc1538ProxyAddress, account);
    console.log('Executing proxy update..');
    await timelockInstance
        .connect(timelockAdminSigner)
        .executeBatch(...updateProxyArgs)
        .then((x) => {
            logTxData(x);
            x.wait();
        });
    await printFunctions(erc1538ProxyAddress, account);
})();
