// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre from 'hardhat';
import { IexecPocoAccessorsFacet__factory } from '../../typechain';
import config from '../../utils/config';
import { getAllFacetAddresses, getFacetInfo } from './diamond-utils';
import { updateDiamondProxy } from './generic-diamond-update';

/**
 * Example: Remove facet by address and add new facet
 * This demonstrates the new facetAddress removal capability
 */
(async () => {
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    const diamondAddress = deploymentOptions.DiamondProxy;

    if (!diamondAddress) {
        throw new Error('DiamondProxy not found in config');
    }

    console.log('🔍 Inspecting current diamond state...');

    // Get all current facets
    const facetAddresses = await getAllFacetAddresses(diamondAddress);
    console.log(`\nFound ${facetAddresses.length} facets in diamond:`);

    for (const address of facetAddresses) {
        const info = await getFacetInfo(diamondAddress, address);
        if (info) {
            console.log(`  ${address}: ${info.functionCount} functions`);
            // Show first few function selectors as preview
            const previewSelectors = info.functionSelectors.slice(0, 3);
            console.log(
                `    Sample functions: ${previewSelectors.join(', ')}${info.functionCount > 3 ? '...' : ''}`,
            );
        }
    }

    // Example 1: Remove a specific facet completely by address
    console.log('\n' + '='.repeat(80));
    console.log('EXAMPLE 1: Remove Facet by Address');
    console.log('='.repeat(80));

    // Let's say we want to remove the first facet (just as an example)
    const targetFacetAddress = facetAddresses[0];

    await updateDiamondProxy({
        description: `Remove facet at address ${targetFacetAddress}`,
        facetsToRemove: [
            {
                name: 'TargetFacet',
                facetAddress: targetFacetAddress,
                // This will remove ALL functions from this specific facet
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
        verbose: true,
    });

    // Example 2: Remove specific functions from a specific facet
    console.log('\n' + '='.repeat(80));
    console.log('EXAMPLE 2: Remove Specific Functions from Specific Facet');
    console.log('='.repeat(80));

    if (facetAddresses.length > 1) {
        const secondFacetAddress = facetAddresses[1];
        const facetInfo = await getFacetInfo(diamondAddress, secondFacetAddress);

        if (facetInfo && facetInfo.functionSelectors.length > 0) {
            // Remove only the first function from this facet
            const selectorsToRemove = [facetInfo.functionSelectors[0]];

            await updateDiamondProxy({
                description: `Remove specific functions from ${secondFacetAddress}`,
                facetsToRemove: [
                    {
                        name: 'PartialFacetRemoval',
                        facetAddress: secondFacetAddress,
                        selectorsToRemove: selectorsToRemove,
                    },
                ],
                facetsToAdd: [],
                verbose: true,
            });
        }
    }

    // Example 3: Using utility function to create removal config
    console.log('\n' + '='.repeat(80));
    console.log('EXAMPLE 3: Using Utility Function');
    console.log('='.repeat(80));

    if (facetAddresses.length > 2) {
        const thirdFacetAddress = facetAddresses[2];

        await updateDiamondProxy({
            description: 'Remove facet using utility function',
            facetsToRemove: [
                {
                    name: 'UtilityCreatedRemoval',
                    facetAddress: thirdFacetAddress,
                },
            ],
            facetsToAdd: [],
            verbose: true,
        });
    }

    // Example 4: Mixed removal methods
    console.log('\n' + '='.repeat(80));
    console.log('EXAMPLE 4: Mixed Removal Methods');
    console.log('='.repeat(80));

    await updateDiamondProxy({
        description: 'Demonstrate multiple removal methods in one operation',
        facetsToRemove: [
            // Remove by factory
            {
                name: 'OldAccessorsByFactory',
                factory: IexecPocoAccessorsFacet__factory,
                removeCompletely: true,
            },
            // Remove by address
            {
                name: 'SpecificFacetByAddress',
                facetAddress: facetAddresses[0], // if it still exists
            },
            // Remove by specific selectors
            {
                name: 'SpecificSelectors',
                selectorsToRemove: [
                    '0x70a08231', // balanceOf()
                    '0x06fdde03', // name()
                ],
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
            },
        ],
        verbose: true,
    });

    console.log('\n✅ All facet address removal examples completed!');
    console.log('\nNew capabilities:');
    console.log('  🎯 Remove facets by specific address');
    console.log('  🔧 Remove specific functions from specific facets');
    console.log('  🛠️ Utility functions for facet inspection');
    console.log('  📊 Combine multiple removal methods in one operation');
    console.log('  🔍 Pre-inspection of diamond state');
})().catch((error) => {
    console.error('❌ Error during facet address removal demo:', error);
    process.exit(1);
});
