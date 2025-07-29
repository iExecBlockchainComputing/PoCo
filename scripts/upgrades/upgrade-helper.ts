// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import { DiamondCutFacet__factory, DiamondLoupeFacet__factory } from '../../typechain';
import { getFunctionSelectors } from '../../utils/proxy-tools';

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

async function printFunctions(diamondProxyAddress: string) {
    const diamondLoupeInstance = DiamondLoupeFacet__factory.connect(
        diamondProxyAddress,
        ethers.provider,
    );
    const facets = await diamondLoupeInstance.facets();

    let totalFunctions = 0;
    facets.forEach((facet) => {
        totalFunctions += facet.functionSelectors.length;
    });

    console.log(`DiamondProxy supports ${totalFunctions} functions:`);

    let functionIndex = 0;
    for (const facet of facets) {
        for (const selector of facet.functionSelectors) {
            // Try to decode the selector to a readable function signature
            // Note: We can't easily get the full function signature from just the selector
            // This is a limitation compared to ERC1538Query.functionByIndex
            console.log(`[${functionIndex}] ${facet.facetAddress} ${selector}`);
            functionIndex++;
        }
    }
}

export { encodeModuleProxyUpdate, printBlockTime, printFunctions };
