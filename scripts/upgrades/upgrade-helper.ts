// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { Interface } from 'ethers';
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
    const block = await ethers.provider.getBlock('latest');
    if (block) {
        const blockTimestamp = block.timestamp;
        console.log(
            `Block#${block.number}: ${new Date(blockTimestamp * 1000)} (timestamp:${blockTimestamp})`,
        );
    }
}

// TODO: update this function to use DiamondLoup
async function printFunctions(diamondProxyAddress: string) {
    const diamondQueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        diamondProxyAddress,
        ethers.provider,
    );
    const functionCount = Number(await diamondQueryInstance.totalFunctions());
    console.log(`DiamondProxy supports ${functionCount} functions:`);
    for (let i = 0; i < functionCount; i++) {
        const [method, , contract] = await diamondQueryInstance.functionByIndex(i);
        console.log(`[${i}] ${contract} ${method}`);
    }
}

export { encodeModuleProxyUpdate, printBlockTime, printFunctions };
