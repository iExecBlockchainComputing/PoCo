// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre from 'hardhat';
import { IexecPocoAccessorsFacet__factory } from '../../typechain';
import config from '../../utils/config';
import { updateDiamondProxy } from './generic-diamond-update';

/**
 * Comprehensive examples showing all diamond update capabilities including facet address removal
 */

// Example 1: Remove facet by specific address
async function example1_RemoveFacetByAddress() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 1: Remove Facet by Address');
    console.log('='.repeat(60));

    await updateDiamondProxy({
        description: 'Remove specific facet by its address',
        facetsToRemove: [
            {
                name: 'SpecificFacetByAddress',
                facetAddress: '0x1234567890123456789012345678901234567890', // Your target facet address
                // This removes ALL functions from this specific facet
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
    });
}

// Example 2: Remove specific functions from specific facet address
async function example2_RemoveSpecificFunctionsFromSpecificFacet() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 2: Remove Specific Functions from Specific Facet');
    console.log('='.repeat(60));

    await updateDiamondProxy({
        description: 'Remove specific functions from specific facet address',
        facetsToRemove: [
            {
                name: 'TargetedFunctionRemoval',
                facetAddress: '0x1234567890123456789012345678901234567890', // Your target facet
                selectorsToRemove: [
                    '0x70a08231', // balanceOf()
                    '0x06fdde03', // name()
                ],
                // Only removes these specific functions from this specific facet
            },
        ],
        facetsToAdd: [],
    });
}

// Example 3: Remove by factory matching (original method)
async function example3_RemoveByFactory() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 3: Remove by Factory Matching');
    console.log('='.repeat(60));

    await updateDiamondProxy({
        description: 'Remove facets by factory matching',
        facetsToRemove: [
            {
                name: 'AccessorFacetsByFactory',
                factory: IexecPocoAccessorsFacet__factory,
                removeCompletely: true,
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
    });
}

// Example 4: Remove by specific selectors (search all facets)
async function example4_RemoveBySelectors() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 4: Remove by Specific Selectors');
    console.log('='.repeat(60));

    await updateDiamondProxy({
        description: 'Remove specific function selectors from any facet',
        facetsToRemove: [
            {
                name: 'SpecificSelectors',
                selectorsToRemove: [
                    '0x70a08231', // balanceOf()
                    '0x06fdde03', // name()
                    '0x95d89b41', // symbol()
                ],
                // Finds and removes these selectors from whatever facets contain them
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
    });
}

// Example 5: Mixed removal methods in one operation
async function example5_MixedRemovalMethods() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 5: Mixed Removal Methods');
    console.log('='.repeat(60));

    await updateDiamondProxy({
        description: 'Demonstrate all removal methods in one operation',
        facetsToRemove: [
            // Method 1: Remove by specific address
            {
                name: 'SpecificFacetAddress',
                facetAddress: '0x1111111111111111111111111111111111111111',
            },
            // Method 2: Remove by factory matching
            {
                name: 'OldAccessorsByFactory',
                factory: IexecPocoAccessorsFacet__factory,
                removeCompletely: true,
            },
            // Method 3: Remove specific selectors from specific facet
            {
                name: 'TargetedFunctionRemoval',
                facetAddress: '0x2222222222222222222222222222222222222222',
                selectorsToRemove: ['0x70a08231', '0x06fdde03'],
            },
            // Method 4: Remove specific selectors from any facet
            {
                name: 'GlobalSelectorRemoval',
                selectorsToRemove: ['0x95d89b41', '0x313ce567'],
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
    });
}

// Example 6: Inspect diamond before removal
async function example6_InspectBeforeRemoval() {
    console.log('='.repeat(60));
    console.log('EXAMPLE 6: Inspect Diamond Before Removal');
    console.log('='.repeat(60));

    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    const diamondAddress = deploymentOptions.DiamondProxy;

    if (!diamondAddress) {
        throw new Error('DiamondProxy not found in config');
    }

    // Import diamond utils to inspect current state
    const { getAllFacetAddresses, getFacetInfo } = await import('./diamond-utils');

    console.log('\n🔍 Inspecting current diamond state...');
    const facetAddresses = await getAllFacetAddresses(diamondAddress);

    console.log(`Found ${facetAddresses.length} facets:`);
    for (const address of facetAddresses) {
        const info = await getFacetInfo(diamondAddress, address);
        if (info) {
            console.log(`  ${address}: ${info.functionCount} functions`);
        }
    }

    // Now remove a specific facet if any exist
    if (facetAddresses.length > 0) {
        await updateDiamondProxy({
            description: `Remove first facet found: ${facetAddresses[0]}`,
            facetsToRemove: [
                {
                    name: 'FirstFacetFound',
                    facetAddress: facetAddresses[0],
                },
            ],
            facetsToAdd: [],
        });
    }
}

// Main execution - choose which example to run
(async () => {
    try {
        // Uncomment the example you want to run:

        // await example1_RemoveFacetByAddress();
        // await example2_RemoveSpecificFunctionsFromSpecificFacet();
        await example3_RemoveByFactory(); // Safe example that matches original behavior
        // await example4_RemoveBySelectors();
        // await example5_MixedRemovalMethods();
        // await example6_InspectBeforeRemoval();

        console.log('\n🎉 Example completed successfully!');
        console.log('\nAll available removal methods:');
        console.log('  🎯 Remove facet by specific address');
        console.log('  🔧 Remove specific functions from specific facet');
        console.log('  🏭 Remove facets by factory matching');
        console.log('  🔍 Remove specific selectors from any facet');
        console.log('  🔄 Mix multiple removal methods in one operation');
        console.log('  📊 Inspect diamond state before operations');
    } catch (error) {
        console.error('❌ Error during diamond update:', error);
        process.exit(1);
    }
})();
