import { Interface } from '@ethersproject/abi';
import { ContractTransaction } from '@ethersproject/contracts';
import { ethers } from 'hardhat';
import { ERC1538Query, ERC1538Query__factory, ERC1538Update__factory } from '../../typechain';

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

async function printFunctions(erc1538ProxyAddress: string) {
    const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        erc1538ProxyAddress,
        ethers.provider,
    );
    const functionCount = await erc1538QueryInstance.totalFunctions();
    console.log(`ERC1538Proxy supports ${functionCount} functions:`);
    for (let i = 0; i < functionCount.toNumber(); i++) {
        const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
        console.log(`[${i}] ${contract} ${method}`);
    }
}

function logTxData(x: ContractTransaction) {
    console.log(x);
}

export { encodeModuleProxyUpdate, printBlockTime, printFunctions, logTxData };
