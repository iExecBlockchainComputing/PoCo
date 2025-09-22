// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import hre from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../../typechain';
import { DiamondCutFacet__factory, DiamondLoupeFacet__factory } from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import config from '../../utils/config';
import { getFunctionSelectors } from '../../utils/proxy-tools';
import { printFunctions } from '../upgrades/upgrade-helper';

/**
 * Configuration for a facet to be removed from the diamond
 */
interface FacetToRemove {
    /** Name of the deployment (used for logging) */
    name: string;
    /** Contract factory class or instance (optional if facetAddress is provided) */
    factory?: any;
    /** Optional: specific facet address to remove completely */
    facetAddress?: string;
    /** Optional: specific function selectors to remove. If not provided, ALL functions will be removed */
    selectorsToRemove?: string[];
    /** Whether to remove all functions from this facet completely */
    removeCompletely?: boolean;
}

/**
 * Configuration for a facet to be added to the diamond
 */
interface FacetToAdd {
    /** Name of the deployment */
    deploymentName: string;
    /** Contract factory class or instance */
    factory: any;
    /** Optional: specific function selectors to add. If not provided, ALL functions will be added */
    selectorsToAdd?: string[];
    /** Whether to save deployment record after update */
    saveDeployment?: boolean;
}

/**
 * Configuration for the diamond update operation
 */
interface DiamondUpdateConfig {
    /** Facets to remove from the diamond */
    facetsToRemove: FacetToRemove[];
    /** Facets to add to the diamond */
    facetsToAdd: FacetToAdd[];
    /** Optional description of the update operation */
    description?: string;
    /** Whether to print detailed logs */
    verbose?: boolean;
}

/**
 * Generic diamond proxy update function
 * @param updateConfig Configuration object containing facets to remove and add
 */
export async function updateDiamondProxy(updateConfig: DiamondUpdateConfig) {
    const {
        facetsToRemove,
        facetsToAdd,
        description = 'Generic diamond proxy update',
        verbose = true,
    } = updateConfig;

    if (verbose) {
        console.log('='.repeat(80));
        console.log(`Diamond Proxy Update: ${description}`);
        console.log('='.repeat(80));
    }

    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;

    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required in config');
    }

    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Network: ${chainId}`);
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);

    const [account] = await hre.ethers.getSigners();

    // Get current diamond state
    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondProxyAddress, account);
    const currentFacets = await diamondLoupe.facets();

    if (verbose) {
        console.log('\nCurrent facets in diamond:');
        currentFacets.forEach((facet) => {
            console.log(`  ${facet.facetAddress}: ${facet.functionSelectors.length} functions`);
        });
    }

    // Prepare libraries if needed
    const iexecLibOrders = deploymentOptions.IexecLibOrders_v5
        ? {
              ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                  deploymentOptions.IexecLibOrders_v5,
          }
        : {};

    const facetCuts: IDiamond.FacetCutStruct[] = [];

    // Process facets to remove
    if (facetsToRemove.length > 0) {
        console.log(`\nProcessing ${facetsToRemove.length} facet(s) to remove:`);

        for (const facetToRemove of facetsToRemove) {
            const functionsToRemove = await processFacetRemoval(
                facetToRemove,
                currentFacets,
                verbose,
            );

            if (functionsToRemove.length > 0) {
                facetCuts.push({
                    facetAddress: ZeroAddress,
                    action: FacetCutAction.Remove,
                    functionSelectors: functionsToRemove,
                });

                if (verbose) {
                    console.log(
                        `  ✓ Prepared removal of ${functionsToRemove.length} functions from ${facetToRemove.name}`,
                    );
                }
            }
        }
    }

    // Process facets to add
    if (facetsToAdd.length > 0) {
        console.log(`\nProcessing ${facetsToAdd.length} facet(s) to add:`);

        for (const facetToAdd of facetsToAdd) {
            const functionsToAdd = await processFacetAddition(
                facetToAdd,
                currentFacets,
                iexecLibOrders,
                verbose,
            );

            if (functionsToAdd.length > 0) {
                const facetAddress = (await hre.deployments.get(facetToAdd.deploymentName)).address;

                facetCuts.push({
                    facetAddress: facetAddress,
                    action: FacetCutAction.Add,
                    functionSelectors: functionsToAdd,
                });

                if (verbose) {
                    console.log(
                        `  ✓ Prepared addition of ${functionsToAdd.length} functions to ${facetToAdd.deploymentName} (${facetAddress})`,
                    );
                }
            }
        }
    }

    // Execute the diamond cut
    if (facetCuts.length === 0) {
        console.log('\nNo changes needed - diamond is already in the desired state.');
        return;
    }

    if (verbose) {
        console.log('\nBefore update:');
        await printFunctions(diamondProxyAddress);
    }

    console.log('\nExecuting diamond cut...');
    console.log(`Total facet cuts: ${facetCuts.length}`);

    if (verbose) {
        facetCuts.forEach((cut, index) => {
            const actionName =
                cut.action === FacetCutAction.Add
                    ? 'ADD'
                    : cut.action === FacetCutAction.Replace
                      ? 'REPLACE'
                      : 'REMOVE';
            console.log(
                `  Cut ${index + 1}: ${actionName} ${cut.functionSelectors.length} functions`,
            );
            console.log(`    Facet: ${cut.facetAddress}`);
        });
    }

    // Get diamond owner and execute the cut
    const proxyOwnerAddress = await Ownable__factory.connect(diamondProxyAddress, account).owner();
    console.log(`Diamond proxy owner: ${proxyOwnerAddress}`);

    const proxyOwnerSigner = await hre.ethers.getImpersonatedSigner(proxyOwnerAddress);
    const diamondProxyWithOwner = DiamondCutFacet__factory.connect(
        diamondProxyAddress,
        proxyOwnerSigner,
    );

    const tx = await diamondProxyWithOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    await tx.wait();

    console.log('Diamond cut executed successfully');
    console.log(`Transaction hash: ${tx.hash}`);

    // Save deployment records for added facets
    for (const facetToAdd of facetsToAdd) {
        if (facetToAdd.saveDeployment !== false) {
            // Default to true
            const facetAddress = (await hre.deployments.get(facetToAdd.deploymentName)).address;
            let factory;

            if (Object.keys(iexecLibOrders).length > 0) {
                // Handle both factory instances and factory classes with libraries
                if (typeof facetToAdd.factory === 'function') {
                    factory = new facetToAdd.factory(iexecLibOrders);
                } else {
                    factory = new (facetToAdd.factory.constructor as any)(iexecLibOrders);
                }
            } else {
                factory =
                    typeof facetToAdd.factory === 'function'
                        ? new facetToAdd.factory()
                        : facetToAdd.factory;
            }

            await hre.deployments.save(facetToAdd.deploymentName, {
                abi: factory.interface.fragments as any,
                address: facetAddress,
                bytecode: factory.bytecode,
            });

            if (verbose) {
                console.log(`  ✓ Saved deployment record for ${facetToAdd.deploymentName}`);
            }
        }
    }

    if (verbose) {
        console.log('\nAfter update:');
        await printFunctions(diamondProxyAddress);
    }

    console.log('\n' + '='.repeat(80));
    console.log('Diamond proxy update completed successfully!');

    if (verbose) {
        console.log('\nSummary of changes:');
        if (facetsToRemove.length > 0) {
            console.log(`  ✓ Removed functions from ${facetsToRemove.length} facet(s)`);
        }
        if (facetsToAdd.length > 0) {
            console.log(`  ✓ Added functions from ${facetsToAdd.length} facet(s)`);
        }
    }
    console.log('='.repeat(80));
}

/**
 * Process a facet removal configuration
 */
async function processFacetRemoval(
    facetToRemove: FacetToRemove,
    currentFacets: any[],
    verbose: boolean,
): Promise<string[]> {
    const { name, factory, facetAddress, selectorsToRemove, removeCompletely } = facetToRemove;
    const functionsToRemove: string[] = [];

    // Method 1: Remove by specific facet address
    if (facetAddress) {
        const targetFacet = currentFacets.find(
            (facet) => facet.facetAddress.toLowerCase() === facetAddress.toLowerCase(),
        );

        if (targetFacet) {
            if (selectorsToRemove) {
                // Remove only specific selectors from this facet
                const selectorsInThisFacet = targetFacet.functionSelectors.filter(
                    (selector: string) => selectorsToRemove.includes(selector),
                );
                functionsToRemove.push(...selectorsInThisFacet);
                if (verbose) {
                    console.log(
                        `  ${name}: Found target facet ${facetAddress} - removing ${selectorsInThisFacet.length} specific functions`,
                    );
                }
            } else {
                // Remove all functions from this specific
                functionsToRemove.push(...targetFacet.functionSelectors);
                if (verbose) {
                    console.log(
                        `  ${name}: Found target facet ${facetAddress} - removing ALL ${targetFacet.functionSelectors.length} functions`,
                    );
                }
            }
        } else {
            if (verbose) {
                console.log(
                    `  ${name}: Target facet ${facetAddress} not found in diamond (safe to ignore)`,
                );
            }
        }

        return Array.from(new Set(functionsToRemove)); // Remove duplicates
    }

    // Method 2: Remove by factory matching
    if (!factory) {
        // If no factory and no facetAddress, we can only use specific selectors
        if (selectorsToRemove) {
            // Find selectors across all facets
            for (const currentFacet of currentFacets) {
                const selectorsInThisFacet = currentFacet.functionSelectors.filter(
                    (selector: string) => selectorsToRemove.includes(selector),
                );
                functionsToRemove.push(...selectorsInThisFacet);
                if (verbose && selectorsInThisFacet.length > 0) {
                    console.log(
                        `  ${name}: Found ${selectorsInThisFacet.length} matching selectors in facet ${currentFacet.facetAddress}`,
                    );
                }
            }
        } else {
            if (verbose) {
                console.log(
                    `  ${name}: No factory or facetAddress provided, and no specific selectors - nothing to remove`,
                );
            }
        }

        return Array.from(new Set(functionsToRemove)); // Remove duplicates
    }

    // Method 3: Remove by factory matching
    const factoryInstance = typeof factory === 'function' ? new factory() : factory;
    const facetSelectors = getFunctionSelectors(factoryInstance);

    // Find matching facets in the current diamond
    for (const currentFacet of currentFacets) {
        const matchingSelectors = currentFacet.functionSelectors.filter((selector: string) =>
            facetSelectors.includes(selector),
        );

        if (matchingSelectors.length > 0) {
            if (removeCompletely) {
                // Remove all functions from this facet
                functionsToRemove.push(...currentFacet.functionSelectors);
                if (verbose) {
                    console.log(
                        `  ${name}: Found facet ${currentFacet.facetAddress} - removing ALL ${currentFacet.functionSelectors.length} functions`,
                    );
                }
            } else if (selectorsToRemove) {
                // Remove only specific selectors
                const selectorsInThisFacet = currentFacet.functionSelectors.filter(
                    (selector: string) => selectorsToRemove.includes(selector),
                );
                functionsToRemove.push(...selectorsInThisFacet);
                if (verbose) {
                    console.log(
                        `  ${name}: Found facet ${currentFacet.facetAddress} - removing ${selectorsInThisFacet.length} specific functions`,
                    );
                }
            } else {
                // Remove matching selectors (default behavior)
                functionsToRemove.push(...matchingSelectors);
                if (verbose) {
                    console.log(
                        `  ${name}: Found facet ${currentFacet.facetAddress} - removing ${matchingSelectors.length} matching functions`,
                    );
                }
            }
        }
    }

    return Array.from(new Set(functionsToRemove)); // Remove duplicates
}

/**
 * Process a facet addition configuration
 */
async function processFacetAddition(
    facetToAdd: FacetToAdd,
    currentFacets: any[],
    iexecLibOrders: any,
    verbose: boolean,
): Promise<string[]> {
    const { deploymentName, factory, selectorsToAdd } = facetToAdd;

    // Create factory with libraries if needed
    let factoryWithLibs;
    if (Object.keys(iexecLibOrders).length > 0) {
        // Handle both factory instances and factory classes
        if (typeof factory === 'function') {
            factoryWithLibs = new factory(iexecLibOrders);
        } else {
            factoryWithLibs = new (factory.constructor as any)(iexecLibOrders);
        }
    } else {
        factoryWithLibs = typeof factory === 'function' ? new factory() : factory;
    }

    // Get function selectors to add
    const allFacetSelectors = getFunctionSelectors(factoryWithLibs);
    const selectorsToProcess = selectorsToAdd || allFacetSelectors;

    // Get the deployment address
    const facetAddress = (await hre.deployments.get(deploymentName)).address;

    // Filter out functions that already exist in other facets
    const existingSelectors = new Set<string>();
    for (const currentFacet of currentFacets) {
        if (currentFacet.facetAddress !== facetAddress) {
            currentFacet.functionSelectors.forEach((selector: string) => {
                existingSelectors.add(selector);
            });
        }
    }

    const functionsToAdd = selectorsToProcess.filter(
        (selector) => !existingSelectors.has(selector),
    );

    if (verbose) {
        const skippedCount = selectorsToProcess.length - functionsToAdd.length;
        console.log(
            `  ${deploymentName}: Adding ${functionsToAdd.length} functions (${skippedCount} skipped - already exist)`,
        );
    }

    return functionsToAdd;
}

// If this script is run directly, provide a usage example
if (require.main === module) {
    console.log('This is a generic diamond proxy update utility.');
    console.log('Import and use the updateDiamondProxy function in your scripts.');
    console.log('\nExample usage:');
    console.log(`
import { updateDiamondProxy } from './generic-diamond-update';
import { SomeFacet__factory, AnotherFacet__factory } from '../typechain';

// Method 1: Remove by factory matching
await updateDiamondProxy({
    description: 'Update to new accessor pattern',
    facetsToRemove: [
        {
            name: 'OldAccessorFacet',
            factory: OldAccessorFacet__factory,
            removeCompletely: true
        }
    ],
    facetsToAdd: [
        {
            deploymentName: 'NewAccessorFacet',
            factory: NewAccessorFacet__factory
        }
    ]
});

// Method 2: Remove by specific facet address
await updateDiamondProxy({
    description: 'Remove specific facet by address',
    facetsToRemove: [
        {
            name: 'SpecificFacet',
            facetAddress: '0x1234567890123456789012345678901234567890'
            // Will remove ALL functions from this facet by default
        }
    ],
    facetsToAdd: []
});

// Method 3: Remove specific functions by selectors
await updateDiamondProxy({
    description: 'Remove specific functions',
    facetsToRemove: [
        {
            name: 'SpecificFunctions',
            selectorsToRemove: ['0x70a08231', '0x06fdde03'] // balanceOf, name
            // Will find these selectors across all facets
        }
    ],
    facetsToAdd: []
});

// Method 4: Remove specific functions from specific facet
await updateDiamondProxy({
    description: 'Remove specific functions from specific facet',
    facetsToRemove: [
        {
            name: 'TargetedRemoval',
            facetAddress: '0x1234567890123456789012345678901234567890',
            selectorsToRemove: ['0x70a08231', '0x06fdde03']
            // Will remove only these selectors from this specific facet
        }
    ],
    facetsToAdd: []
});
    `);
}
