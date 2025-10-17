// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, Interface, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecAccessorsABILegacyFacet__factory,
    IexecCategoryManagerFacet__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecERC20Facet__factory,
    IexecEscrowNativeFacet__factory,
    IexecEscrowTokenFacet__factory,
    IexecEscrowTokenSwapFacet__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet__factory,
    IexecRelayFacet__factory,
    OwnershipFacet__factory,
} from '../../typechain';
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

    const allInterfaces: Interface[] = [
        OwnershipFacet__factory.createInterface(),
        DiamondCutFacet__factory.createInterface(),
        DiamondLoupeFacet__factory.createInterface(),
        IexecAccessorsABILegacyFacet__factory.createInterface(),
        IexecCategoryManagerFacet__factory.createInterface(),
        IexecConfigurationExtraFacet__factory.createInterface(),
        IexecConfigurationFacet__factory.createInterface(),
        IexecERC20Facet__factory.createInterface(),
        IexecEscrowNativeFacet__factory.createInterface(),
        IexecEscrowTokenFacet__factory.createInterface(),
        IexecEscrowTokenSwapFacet__factory.createInterface(),
        IexecOrderManagementFacet__factory.createInterface(),
        IexecPoco1Facet__factory.createInterface(),
        IexecPoco2Facet__factory.createInterface(),
        IexecPocoAccessorsFacet__factory.createInterface(),
        IexecPocoBoostAccessorsFacet__factory.createInterface(),
        IexecPocoBoostFacet__factory.createInterface(),
        IexecRelayFacet__factory.createInterface(),
    ];
    const selectorToName = new Map<string, string>();
    for (const iface of allInterfaces) {
        for (const fragment of iface.fragments) {
            if (fragment.type === 'function') {
                const signature = fragment.format();
                const funcFragment = iface.getFunction(signature);
                if (funcFragment) {
                    selectorToName.set(funcFragment.selector, funcFragment.name);
                }
            }
        }
    }

    let totalFunctions = 0;
    facets.forEach((facet) => {
        totalFunctions += facet.functionSelectors.length;
    });

    console.log(`DiamondProxy supports ${totalFunctions} functions:`);

    let functionIndex = 0;
    for (const facet of facets) {
        for (const selector of facet.functionSelectors) {
            let functionName = selector; // Default to selector if we can't decode
            // Special cases for special functions
            if (selector === '0x00000000') {
                functionName = 'receive()';
            } else if (selector === '0xffffffff') {
                functionName = 'fallback()';
            } else {
                const name = selectorToName.get(selector);
                if (name) {
                    functionName = name;
                }
            }
            console.log(`[${functionIndex}] ${facet.facetAddress} ${functionName}`);
            functionIndex++;
        }
    }
}

export { encodeModuleProxyUpdate, printBlockTime, printFunctions };
