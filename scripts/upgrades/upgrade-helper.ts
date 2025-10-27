// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import { DiamondCutFacet__factory } from '../../typechain';
import { getFunctionSelectors } from '../../utils/proxy-tools';

// TODO remove this module.

function encodeModuleProxyUpdate(contractFactory: ContractFactory, moduleAddress: string) {
    // Get function selectors from the contract factory
    const functionSelectors = getFunctionSelectors(contractFactory);

    // Create FacetCut for adding the module
    const facetCut = {
        facetAddress: moduleAddress,
        action: FacetCutAction.Add,
        functionSelectors: functionSelectors,
    };

    // Encode diamondCut call
    const moduleProxyUpdateData = DiamondCutFacet__factory.createInterface().encodeFunctionData(
        'diamondCut',
        [[facetCut], ZeroAddress, '0x'],
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

export { encodeModuleProxyUpdate, printBlockTime };
