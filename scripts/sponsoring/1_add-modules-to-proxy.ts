import { time } from '@nomicfoundation/hardhat-network-helpers';
import { Wallet } from 'ethers';
import hre, { ethers, expect } from 'hardhat';
import CONFIG from '../../config/config.json';
import {
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
    Ownable__factory,
    TimelockController__factory,
} from '../../typechain';
import {
    TimelockOperation,
    TimelockOperations,
    encodeModuleProxyUpdate,
    logTxData,
    printFunctions,
} from '../upgrades/upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;
    const erc1538ProxyAddress = deploymentOptions.ERC1538Proxy;
    // Random salt but must be the same for schedule & execute
    const operationSalt = '0x0be814a62c44af32241a2c964e5680d1b25c783473c6e7875cbc8071770d7ff0'; // Random
    const timelockAddress = await Ownable__factory.connect(
        erc1538ProxyAddress,
        ethers.provider,
    ).owner();
    const timelockInstance = TimelockController__factory.connect(timelockAddress, ethers.provider);
    let delay = await timelockInstance.getMinDelay();

    // Fetch timelock admin wallet
    const TIMELOCK_ADMIN_ROLE = await timelockInstance.TIMELOCK_ADMIN_ROLE();
    const timelockAdminAddress = await timelockInstance.getRoleMember(TIMELOCK_ADMIN_ROLE, 0);
    console.log(`Timelock admin: ${timelockAdminAddress}`);
    const timelockAdminPrivateKey = process.env.TIMELOCK_ADMIN_PRIVATE_KEY;
    let timelockAdmin;
    if (timelockAdminPrivateKey) {
        console.log('Using timelock admin wallet from TIMELOCK_ADMIN_PRIVATE_KEY.');
        timelockAdmin = Wallet.fromMnemonic(timelockAdminPrivateKey);
    } else {
        console.log('Using impersonated timelock admin wallet.');
        timelockAdmin = await ethers.getImpersonatedSigner(timelockAdminAddress);
    }
    expect(timelockAdmin.address).equal(
        timelockAdminAddress,
        'Failed to get timelock admin wallet',
    );

    const timelockProposerExecutor = (await ethers.getSigners())[0];
    const rpcUrl = ethers.provider.connection.url;
    const isBellecourFork = rpcUrl.includes('localhost') && chainId == 134;
    if (isBellecourFork) {
        // Add new timelock proposer/executor
        const PROPOSER_ROLE = await timelockInstance.PROPOSER_ROLE();
        await timelockInstance
            .connect(timelockAdmin)
            .grantRole(PROPOSER_ROLE, timelockProposerExecutor.address)
            .then((tx) => tx.wait());
        const EXECUTOR_ROLE = await timelockInstance.EXECUTOR_ROLE();
        await timelockInstance
            .connect(timelockAdmin)
            .grantRole(EXECUTOR_ROLE, timelockProposerExecutor.address)
            .then((tx) => tx.wait());
        expect(
            await timelockInstance.getRoleMember(
                PROPOSER_ROLE,
                (await timelockInstance.getRoleMemberCount(PROPOSER_ROLE)).sub(1),
            ),
        ).equal(timelockProposerExecutor.address, 'Failed to add new timelock proposer');
        expect(
            await timelockInstance.getRoleMember(
                EXECUTOR_ROLE,
                (await timelockInstance.getRoleMemberCount(EXECUTOR_ROLE)).sub(1),
            ),
        ).equal(timelockProposerExecutor.address, 'Failed to add new timelock executor');

        // Remove timelock delay
        const removeTimelockDelayArgs: TimelockOperation = [
            timelockAddress,
            0,
            (await timelockInstance.populateTransaction.updateDelay(0).then((tx) => tx.data)) || '',
            ethers.constants.HashZero,
            operationSalt,
        ];
        console.log('Scheduling timelock delay removal..');
        await timelockInstance
            .connect(timelockProposerExecutor)
            .schedule(...removeTimelockDelayArgs, delay)
            .then((tx) => {
                logTxData(tx);
                tx.wait();
            });
        console.log('Time traveling..');
        await time.increase(delay);
        console.log('Executing timelock delay removal..');
        await timelockInstance
            .connect(timelockProposerExecutor)
            .execute(...removeTimelockDelayArgs)
            .then((x) => {
                logTxData(x);
                x.wait();
            });
        delay = await timelockInstance.getMinDelay();
        expect(delay).equal(0, 'Failed to remove timelock delay');
    }

    // Update ERC1538 proxy
    const iexecPoco1DelegateAddress = (await hre.deployments.get('IexecPoco1Delegate')).address;
    const iexecPoco2DelegateAddress = (await hre.deployments.get('IexecPoco2Delegate')).address;
    const iexecPocoAccessorsDelegateAddress = (
        await hre.deployments.get('IexecPocoAccessorsDelegate')
    ).address;
    console.log('Functions about to be added to proxy:');
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
    const updates = [iexecPoco1ProxyUpdate, iexecPoco2ProxyUpdate, iexecPocoAccessorsProxyUpdate];
    const updateProxyArgs: TimelockOperations = [
        Array(updates.length).fill(erc1538ProxyAddress),
        Array(updates.length).fill(0),
        updates,
        ethers.constants.HashZero,
        operationSalt,
    ];
    console.log(`Scheduling/executing proxy update with ${delay}s delay..`);
    await timelockInstance
        .connect(timelockProposerExecutor)
        .scheduleBatch(...updateProxyArgs, delay)
        .then((tx) => {
            logTxData(tx);
            tx.wait();
        });
    if (delay.gt(0)) {
        console.log(`Please wait ${delay}s delay before executing proxy update`);
        return;
    }
    await timelockInstance
        .connect(timelockProposerExecutor)
        .executeBatch(...updateProxyArgs)
        .then((x) => {
            logTxData(x);
            x.wait();
        });
    await printFunctions(erc1538ProxyAddress);
})();
