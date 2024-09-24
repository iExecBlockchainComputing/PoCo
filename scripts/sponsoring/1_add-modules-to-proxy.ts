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

const txHash = '0x59c94a0206187ff9cfe36bf380dfa012f25b51189e321ed70650827230ab8bd7';

if (process.env.HANDLE_SPONSORING_UPGRADE_INTERNALLY != 'true') {
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
    await printBlockTime();
    const timelockInstance = TimelockController__factory.connect(timelockAddress, ethers.provider);
    const iface = new ethers.utils.Interface([
        'event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)',
    ]);
    const delay = await timelockInstance.getMinDelay();
    const timelockAdminAddress = await timelockInstance.getRoleMember(
        await timelockInstance.PROPOSER_ROLE(),
        0,
    );
    console.log(`Expected Timelock proposer: ${timelockAdminAddress}`);
    // const [proposer] = await ethers.getSigners();
    // console.log(`Actual Timelock proposer: ${proposer.address}`);
    // if (proposer.address != timelockAdminAddress) {
    //     console.error('Bad proposer');
    //     process.exit(1);
    // }
    const timelockAdminSigner = await ethers.getImpersonatedSigner(timelockAdminAddress);
    // proposer; #used when we have the pvk

    // await scheduleUpgrade();
    // console.log('Upgrade is proposed, stopping now.');
    // process.exit(0);

    // Fetch transaction receipt
    const txReceipt = await ethers.provider.getTransactionReceipt(txHash);
    const blockNumber = txReceipt.blockNumber;
    const block = await ethers.provider.getBlock(blockNumber);
    const blockTimestamp = block.timestamp;

    console.log(`Transaction was included in block: ${blockNumber}`);
    console.log(`Block timestamp: ${blockTimestamp} (in seconds since Unix epoch)`);

    for (const log of txReceipt.logs) {
        try {
            const parsedLog = iface.parseLog(log);
            if (parsedLog) {
                const delay = parsedLog.args.delay;
                console.log(`Delay found: ${delay} seconds`);

                // Calculate how much time to increase
                const currentBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
                console.log(`Current block timestamp: ${currentBlockTimestamp} seconds `);
                const elapsedTime = currentBlockTimestamp - blockTimestamp;
                console.log(`Elapsed time since transaction: ${elapsedTime} seconds`);
                const timeToTravel = delay.sub(BigNumber.from(Math.round(elapsedTime)));

                console.log(`Time to travel: ${timeToTravel} seconds`);
                await time.increase(timeToTravel);
                console.log('Time traveling..');
                await executeUpgrade();
                return erc1538ProxyAddress;
            }
        } catch (error) {
            console.error('Error parsing log:', error);
            return erc1538ProxyAddress;
        }
    }

    return erc1538ProxyAddress;

    async function scheduleUpgrade() {
        await timelockInstance
            .connect(timelockAdminSigner)
            .scheduleBatch(...updateProxyArgs, delay)
            .then((tx) => {
                logTxData(tx);
                tx.wait();
            });
    }

    async function executeUpgrade() {
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
    }
}
