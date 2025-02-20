// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractTransactionResponse, Interface } from 'ethers';
import { ethers } from 'hardhat';
import { ERC1538Query, ERC1538Query__factory, ERC1538Update__factory } from '../../typechain';

function encodeModuleProxyUpdate(ModuleInterface: Interface, moduleAddress: string) {
    let moduleFunctions = '';
    ModuleInterface.forEachFunction((functionFragment) => {
        const func = functionFragment.format();
        console.log(`- ${func}`);
        moduleFunctions += func + ';';
    });
    const moduleProxyUpdateData = ERC1538Update__factory.createInterface().encodeFunctionData(
        'updateContract',
        [moduleAddress, moduleFunctions, ''],
    );
    return moduleProxyUpdateData;
}

async function printBlockTime() {
    await ethers.provider.getBlock('latest').then((latestBlock) => {
        if (latestBlock) {
            const blockNumber = latestBlock.number;
            const blockTimestamp = latestBlock.timestamp;
            const blockDate = new Date(blockTimestamp * 1000);
            console.log(`Block#${blockNumber}: ${blockDate} (timestamp:${blockTimestamp})`);
        }
    });
}

async function printFunctions(erc1538ProxyAddress: string) {
    const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        erc1538ProxyAddress,
        ethers.provider,
    );
    const functionCount = Number(await erc1538QueryInstance.totalFunctions());
    console.log(`ERC1538Proxy supports ${functionCount} functions:`);
    for (let i = 0; i < functionCount; i++) {
        const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
        console.log(`[${i}] ${contract} ${method}`);
    }
}

function logTxData(x: ContractTransactionResponse) {
    console.log(x);
}

export { encodeModuleProxyUpdate, printBlockTime, printFunctions, logTxData };
