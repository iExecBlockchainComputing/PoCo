// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre from 'hardhat';
import { DiamondLoupeFacet__factory } from '../../../typechain';

/**
 * Utility functions for diamond proxy management
 */

/**
 * Get all function selectors currently deployed in a diamond
 * @param diamondAddress The diamond proxy address
 * @returns Map of facet address to function selectors
 */
export async function getDiamondState(diamondAddress: string): Promise<Map<string, string[]>> {
    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondAddress, hre.ethers.provider);
    const facets = await diamondLoupe.facets();

    const state = new Map<string, string[]>();
    for (const facet of facets) {
        state.set(facet.facetAddress, [...facet.functionSelectors]);
    }

    return state;
}

/**
 * Find which facet contains a specific function selector
 * @param diamondAddress The diamond proxy address
 * @param functionSelector The 4-byte function selector to find
 * @returns The facet address containing the function, or null if not found
 */
export async function findFacetWithFunction(
    diamondAddress: string,
    functionSelector: string,
): Promise<string | null> {
    const state = await getDiamondState(diamondAddress);

    for (const [facetAddress, selectors] of state) {
        if (selectors.includes(functionSelector)) {
            return facetAddress;
        }
    }

    return null;
}

/**
 * Get detailed information about a specific facet
 * @param diamondAddress The diamond proxy address
 * @param facetAddress The facet address to inspect
 * @returns Facet information or null if not found
 */
export async function getFacetInfo(
    diamondAddress: string,
    facetAddress: string,
): Promise<{
    address: string;
    functionSelectors: string[];
    functionCount: number;
} | null> {
    const state = await getDiamondState(diamondAddress);
    const selectors = state.get(facetAddress);

    if (!selectors) {
        return null;
    }

    return {
        address: facetAddress,
        functionSelectors: selectors,
        functionCount: selectors.length,
    };
}

/**
 * Validate diamond update configuration before execution
 * @param diamondAddress The diamond proxy address
 * @param updateConfig The update configuration to validate
 * @returns Validation results with warnings and errors
 */
export async function validateDiamondUpdate(
    diamondAddress: string,
    updateConfig: any,
): Promise<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
}> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
        // Check for functions to remove that don't exist
        for (const facetToRemove of updateConfig.facetsToRemove || []) {
            if (facetToRemove.selectorsToRemove) {
                for (const selector of facetToRemove.selectorsToRemove) {
                    const existingFacet = await findFacetWithFunction(diamondAddress, selector);
                    if (!existingFacet) {
                        warnings.push(`Function ${selector} not found in diamond (safe to ignore)`);
                    }
                }
            }
        }

        // Check for functions to add that already exist
        for (const facetToAdd of updateConfig.facetsToAdd || []) {
            if (facetToAdd.selectorsToAdd) {
                for (const selector of facetToAdd.selectorsToAdd) {
                    const existingFacet = await findFacetWithFunction(diamondAddress, selector);
                    if (existingFacet) {
                        warnings.push(
                            `Function ${selector} already exists in facet ${existingFacet}`,
                        );
                    }
                }
            }
        }

        // Check for empty operations
        const hasRemovals = updateConfig.facetsToRemove?.length > 0;
        const hasAdditions = updateConfig.facetsToAdd?.length > 0;

        if (!hasRemovals && !hasAdditions) {
            errors.push('No facets to remove or add - update configuration is empty');
        }
    } catch (error) {
        errors.push(`Validation failed: ${error}`);
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors,
    };
}

/**
 * Create a summary of what the diamond update will do
 * @param diamondAddress The diamond proxy address
 * @param updateConfig The update configuration
 * @returns Summary object with operation details
 */
export async function createUpdateSummary(
    diamondAddress: string,
    updateConfig: any,
): Promise<{
    functionsToRemove: number;
    functionsToAdd: number;
    facetsToRemove: number;
    facetsToAdd: number;
    affectedFacets: string[];
}> {
    const currentState = await getDiamondState(diamondAddress);
    const affectedFacets = new Set<string>();

    let functionsToRemove = 0;
    let functionsToAdd = 0;

    // Count removals
    for (const facetToRemove of updateConfig.facetsToRemove || []) {
        if (facetToRemove.selectorsToRemove) {
            functionsToRemove += facetToRemove.selectorsToRemove.length;
        }

        // Find affected facets
        for (const [facetAddress, selectors] of currentState) {
            if (facetToRemove.selectorsToRemove) {
                const hasMatchingSelectors = selectors.some((s) =>
                    facetToRemove.selectorsToRemove.includes(s),
                );
                if (hasMatchingSelectors) {
                    affectedFacets.add(facetAddress);
                }
            }
        }
    }

    // Count additions
    for (const facetToAdd of updateConfig.facetsToAdd || []) {
        if (facetToAdd.selectorsToAdd) {
            functionsToAdd += facetToAdd.selectorsToAdd.length;
        } else if (facetToAdd.factory) {
            // Count all functions from factory
            const factoryInstance =
                typeof facetToAdd.factory === 'function'
                    ? new facetToAdd.factory()
                    : facetToAdd.factory;
            const allSelectors = factoryInstance.interface.fragments.filter(
                (f: any) => f.type === 'function',
            ).length;
            functionsToAdd += allSelectors;
        }
    }

    return {
        functionsToRemove,
        functionsToAdd,
        facetsToRemove: updateConfig.facetsToRemove?.length || 0,
        facetsToAdd: updateConfig.facetsToAdd?.length || 0,
        affectedFacets: Array.from(affectedFacets),
    };
}

/**
 * Helper to create function selector from function signature
 * @param functionSignature Function signature like "balanceOf(address)"
 * @returns 4-byte function selector
 */
export function getFunctionSelector(functionSignature: string): string {
    return hre.ethers.id(functionSignature).slice(0, 10);
}

/**
 * Helper for example - Get all facet addresses in the diamond
 * @param diamondAddress The diamond proxy address
 * @returns Array of facet addresses
 */
export async function getAllFacetAddresses(diamondAddress: string): Promise<string[]> {
    const state = await getDiamondState(diamondAddress);
    return Array.from(state.keys());
}

/**
 * Common function selectors for typical ERC20/ERC721 functions
 */
export const COMMON_SELECTORS = {
    // ERC20
    ERC20_BALANCE_OF: '0x70a08231',
    ERC20_NAME: '0x06fdde03',
    ERC20_SYMBOL: '0x95d89b41',
    ERC20_DECIMALS: '0x313ce567',
    ERC20_TOTAL_SUPPLY: '0x18160ddd',
    ERC20_ALLOWANCE: '0xdd62ed3e',
    ERC20_TRANSFER: '0xa9059cbb',
    ERC20_APPROVE: '0x095ea7b3',

    // Ownable
    OWNABLE_OWNER: '0x8da5cb5b',
    OWNABLE_TRANSFER_OWNERSHIP: '0xf2fde38b',

    // Diamond specific
    DIAMOND_CUT: '0x1f931c1c',
    DIAMOND_FACETS: '0x7a0ed627',
    DIAMOND_FACET_FUNCTION_SELECTORS: '0xadfca15e',
    DIAMOND_FACET_ADDRESSES: '0x52ef6b2c',
    DIAMOND_FACET_ADDRESS: '0xcdffacc6',
} as const;
