import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { BytesLike } from '@ethersproject/bytes';
import { ContractTransaction } from '@ethersproject/contracts';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { Signer } from 'ethers';
import hre, { ethers } from 'hardhat';
import CONFIG from '../../config/config.json';
import {
    ERC1538Query,
    ERC1538Query__factory,
    ERC1538Update__factory,
    IexecPocoBoostAccessors__factory,
    IexecPocoBoost__factory,
    TimelockController__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';

(async () => {
    const chainId = (await ethers.provider._networkPromise).chainId;
    const deploymentOptions = CONFIG.chains[chainId].v5;
    console.log('Link Boost functions to proxy:');
    const timelockAdminAddress = '0x0B3a38b0A47aB0c5E8b208A703de366751Df5916';
    const erc1538ProxyAddress = deploymentOptions.ERC1538Proxy;
    const iexecPocoBoostDelegateAddress = (await hre.deployments.get('IexecPocoBoostDelegate'))
        .address; // Bellecour: 0x8425229f979AB3b0dDDe00D475D762cA4d6a5eFc
    const iexecPocoBoostAccessorsDelegateAddress = (
        await hre.deployments.get('IexecPocoBoostAccessorsDelegate')
    ).address; // Bellecour: 0x56185a2b0dc8b556BBfBAFB702BC971Ed75e868C
    const [account] = await hre.ethers.getSigners();
    const timelockAddress = await Ownable__factory.connect(erc1538ProxyAddress, account).owner(); // Bellecour: 0x4611B943AA1d656Fc669623b5DA08756A7e288E9
    const timelockAdminSigner = await ethers.getImpersonatedSigner(timelockAdminAddress);
    const iexecPocoBoostProxyUpdate = encodeModuleProxyUpdate(
        IexecPocoBoost__factory.createInterface(),
        iexecPocoBoostDelegateAddress,
    );
    const iexecPocoBoostAccessorsProxyUpdate = encodeModuleProxyUpdate(
        IexecPocoBoostAccessors__factory.createInterface(),
        iexecPocoBoostAccessorsDelegateAddress,
    );
    // Salt but must be the same for schedule & execute
    const operationSalt = '0x0be814a62c44af32241a2c964e5680d1b25c783473c6e7875cbc8071770d7ff0'; // Random
    const delay = 60 * 60 * 24 * 7;
    const updateProxyArgs = [
        Array(2).fill(erc1538ProxyAddress),
        Array(2).fill(0),
        [iexecPocoBoostProxyUpdate, iexecPocoBoostAccessorsProxyUpdate],
        ethers.constants.HashZero,
        operationSalt,
    ] as [string[], BigNumber[], BytesLike[], BytesLike, BytesLike];
    console.log('Scheduling proxy update..');
    await printBlockTime();
    await TimelockController__factory.connect(timelockAddress, timelockAdminSigner)
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
    await TimelockController__factory.connect(timelockAddress, timelockAdminSigner)
        .executeBatch(...updateProxyArgs)
        .then((x) => {
            logTxData(x);
            x.wait();
        });
    await printFunctions(erc1538ProxyAddress, account);
})();

function encodeModuleProxyUpdate(ModuleInterface: Interface, moduleAddress: string) {
    const moduleFunctions = Object.keys(ModuleInterface.functions).map((tx) => tx + ';');
    moduleFunctions.forEach((func) => {
        console.log(`- ${func}`);
    });
    const moduleProxyUpdateData = ERC1538Update__factory.createInterface().encodeFunctionData(
        'updateContract',
        [moduleAddress, moduleFunctions.join(''), ''],
    );
    return moduleProxyUpdateData;
}

async function printBlockTime() {
    const latestBlock = await ethers.provider.getBlock('latest');
    const blockNumber = latestBlock.number;
    const blockTimestamp = latestBlock.timestamp;
    const blockDate = new Date(blockTimestamp * 1000);
    console.log(`Block#${blockNumber}: ${blockDate} (timestamp:${blockTimestamp})`);
}

async function printFunctions(erc1538ProxyAddress: string, owner: Signer) {
    const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        erc1538ProxyAddress,
        owner,
    );
    const functionCount = await erc1538QueryInstance.totalFunctions();
    console.log(`ERC1538Proxy supports ${functionCount} functions`);
}

function logTxData(x: ContractTransaction) {
    console.log(`{ data: '${x.data}' }`);
}
