import { Interface } from '@ethersproject/abi';
import { ContractTransaction } from '@ethersproject/contracts';
import { Signer } from 'ethers';
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

// TODO: Move these in common tools
export { encodeModuleProxyUpdate, printBlockTime, printFunctions, logTxData };
