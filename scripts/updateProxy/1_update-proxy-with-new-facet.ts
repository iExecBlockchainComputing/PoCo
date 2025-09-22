// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../../typechain';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import config from '../../utils/config';
import { getFunctionSelectors } from '../../utils/proxy-tools';
import { printFunctions } from '../upgrades/upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;

    console.log(
        'Updating diamond proxy: removing automatic getters and adding new IexecPocoAccessorsFacet...',
    );
    console.log(
        `  - Removing: Only automatic getters from public constants (keeping legacy ABI functions)`,
    );
    console.log(
        `  - Adding: IexecPocoAccessorsFacet (with explicit getters for internal constants)`,
    );
    console.log(`Network: ${chainId}`);

    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }

    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);

    const [account] = await ethers.getSigners();

    const updatedFacetAddress = (await deployments.get('IexecPocoAccessorsFacet')).address; //C
    console.log(`Updated facet address: ${updatedFacetAddress}`);

    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondProxyAddress, account);
    const facets = await diamondLoupe.facets();

    console.log('\nCurrent facets in diamond:');
    facets.forEach((facet) => {
        console.log(`  ${facet.facetAddress}: ${facet.functionSelectors.length} functions`);
    });

    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    // Find the specific old accessor facets to remove completely
    const oldAccessorFacets = new Set<string>();

    // Legacy accessor function signatures
    const legacyAccessorFunctionSignatures = [
        '0x70a08231', // balanceOf()
        '0x06fdde03', // name()
        '0x95d89b41', // symbol()
        '0x313ce567', // decimals()
        '0x18160ddd', // totalSupply()
        '0xdd62ed3e', // allowance()
        '0x9910fd72', // workerpoolByIndex()
        '0xdb8aaa26', // appByIndex()
        '0x1bf6e00d', // datasetByIndex()
    ];

    // Automatic getters from previous public constants that need to be removed
    const automaticGettersFromPublicConstants = [
        '0x7b244832', // CONTRIBUTION_DEADLINE_RATIO()
        '0x5fde601d', // REVEAL_DEADLINE_RATIO()
        '0x90fc26b1', // FINAL_DEADLINE_RATIO()
        '0x4ec3b9e3', // WORKERPOOL_STAKE_RATIO()
        '0x51152de1', // KITTY_RATIO()
        '0xe2e7a8c1', // KITTY_MIN()
        '0x9e986e81', // KITTY_ADDRESS()
        '0x68a9ef1c', // GROUPMEMBER_PURPOSE()
    ];
    // NOTE: We are NOT removing legacy ABI functions - they will stay in IexecAccessorsABILegacyFacet

    const specificFunctionSignature = '0x66517ca6'; // ComputeDealVolume

    // Find the current accessor facets in the diamond that need to be updated
    const facetsWithFunctionsToRemove = new Map<string, string[]>();
    const facetsToRemoveCompletely = new Set<string>();

    // Find facets that contain functions we want to remove
    for (const facet of facets) {
        const functionsToRemoveFromThisFacet: string[] = [];
        let hasLegacyAccessorFunctions = false;

        // Check each function in this facet
        for (const selector of facet.functionSelectors) {
            // Check if this facet has legacy accessor functions (if so, we remove ALL functions)
            if (legacyAccessorFunctionSignatures.includes(selector)) {
                hasLegacyAccessorFunctions = true;
                break;
            }
            // Check for automatic getters that need selective removal
            if (automaticGettersFromPublicConstants.includes(selector)) {
                functionsToRemoveFromThisFacet.push(selector);
            }
        }

        // If this facet has legacy accessor functions, remove ALL functions from it
        if (hasLegacyAccessorFunctions) {
            facetsToRemoveCompletely.add(facet.facetAddress);
            facetsWithFunctionsToRemove.set(facet.facetAddress, [...facet.functionSelectors]);
            console.log(
                `Found facet ${facet.facetAddress} with legacy accessor functions - will remove ALL ${facet.functionSelectors.length} functions`,
            );
        }
        // Otherwise, if it has automatic getters, remove only those
        else if (functionsToRemoveFromThisFacet.length > 0) {
            facetsWithFunctionsToRemove.set(facet.facetAddress, functionsToRemoveFromThisFacet);
            console.log(
                `Found facet ${facet.facetAddress} with ${functionsToRemoveFromThisFacet.length} automatic getters to remove`,
            );
            console.log(`  Functions: ${functionsToRemoveFromThisFacet.join(', ')}`);
        }

        // Also check for the specific ComputeDealVolume function
        const hasSpecificFunction = facet.functionSelectors.includes(specificFunctionSignature);
        if (hasSpecificFunction && !hasLegacyAccessorFunctions) {
            const existing = facetsWithFunctionsToRemove.get(facet.facetAddress) || [];
            if (!existing.includes(specificFunctionSignature)) {
                existing.push(specificFunctionSignature);
                facetsWithFunctionsToRemove.set(facet.facetAddress, existing);
            }
            console.log(`Found facet ${facet.facetAddress} with ComputeDealVolume function`);
        }
    }

    // Find functions that need to be removed - ONLY specific functions, not entire facets
    const functionsToRemove: string[] = [];
    const functionsToRemoveByFacet = new Map<string, string[]>();

    // Collect all functions to remove from each facet
    for (const [facetAddress, selectors] of facetsWithFunctionsToRemove) {
        if (facetsToRemoveCompletely.has(facetAddress)) {
            console.log(
                `Will remove ALL ${selectors.length} functions from legacy accessor facet ${facetAddress}`,
            );
        } else {
            console.log(
                `Will remove ${selectors.length} specific functions from facet ${facetAddress}:`,
            );
            console.log(
                `  Automatic getters: ${selectors.filter((s) => automaticGettersFromPublicConstants.includes(s)).length}`,
            );
            console.log(
                `  ComputeDealVolume: ${selectors.includes(specificFunctionSignature) ? 1 : 0}`,
            );
        }

        functionsToRemove.push(...selectors);
        functionsToRemoveByFacet.set(facetAddress, [...selectors]);
    }

    // Functions to add - ALL functions from the new facet, but exclude any that exist in other (non-accessor) facets
    const newFacetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders); //C
    const allNewFunctionSelectors = getFunctionSelectors(newFacetFactory);

    const functionsInOtherFacets = new Set<string>();
    for (const facet of facets) {
        // Skip facets that have functions being removed and the updated facet (if it already exists)
        if (
            !facetsWithFunctionsToRemove.has(facet.facetAddress) &&
            facet.facetAddress !== updatedFacetAddress
        ) {
            facet.functionSelectors.forEach((selector) => {
                if (allNewFunctionSelectors.includes(selector)) {
                    functionsInOtherFacets.add(selector);
                    console.log(
                        ` Function ${selector} already exists in other facet ${facet.facetAddress} - will not add`,
                    );
                }
            });
        }
    }

    const newFunctionSelectors = allNewFunctionSelectors.filter(
        (selector) => !functionsInOtherFacets.has(selector),
    );

    console.log(`Total functions to remove from facets: ${functionsToRemove.length}`);
    console.log(`  - Facets with legacy accessor functions: COMPLETE removal`);
    console.log(`  - Automatic getters from public constants: SELECTIVE removal`);
    console.log(`  - ComputeDealVolume function: SELECTIVE removal`);
    console.log(`  - Legacy ABI functions will be KEPT in IexecAccessorsABILegacyFacet`);
    console.log(`Functions skipped (exist in other facets): ${functionsInOtherFacets.size}`);
    console.log(`Functions to add to new IexecPocoAccessorsFacet: ${newFunctionSelectors.length}`);
    console.log(`  - Explicit getter functions for constants (now internal)`);
    console.log(`  - New accessor functions with improved interfaces`);

    const facetCuts: IDiamond.FacetCutStruct[] = [];
    // Remove functions from facets (complete removal for legacy accessor facets, selective for others)
    for (const [facetAddress, selectors] of functionsToRemoveByFacet) {
        if (selectors.length > 0) {
            const isCompleteRemoval = facetsToRemoveCompletely.has(facetAddress);
            console.log(
                `${isCompleteRemoval ? 'Completely removing' : 'Selectively removing'} ${selectors.length} functions from facet ${facetAddress}`,
            );

            facetCuts.push({
                facetAddress: ZeroAddress,
                action: FacetCutAction.Remove,
                functionSelectors: [...selectors],
            });
        }
    }

    // Add new functions
    if (newFunctionSelectors.length > 0) {
        console.log(
            `Preparing to add ${newFunctionSelectors.length} functions to new facet ${updatedFacetAddress}`,
        );
        facetCuts.push({
            facetAddress: updatedFacetAddress,
            action: FacetCutAction.Add,
            functionSelectors: [...newFunctionSelectors],
        });
    }

    console.log('Functions before upgrade:');
    await printFunctions(diamondProxyAddress);

    const proxyOwnerAddress = await Ownable__factory.connect(diamondProxyAddress, account).owner();
    console.log(`Diamond proxy owner: ${proxyOwnerAddress}`);
    const proxyOwnerSigner = await ethers.getImpersonatedSigner(proxyOwnerAddress);
    const diamondProxyWithOwner = DiamondCutFacet__factory.connect(
        diamondProxyAddress,
        proxyOwnerSigner,
    );

    console.log('Executing diamond cut...');
    console.log(`Facet cuts: ${facetCuts.length}`);
    facetCuts.forEach((cut, index) => {
        console.log(`  Cut ${index + 1}: ${cut.action} ${cut.functionSelectors.length} functions`);
        console.log(`    Facet: ${cut.facetAddress}`);
    });

    const tx = await diamondProxyWithOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    await tx.wait();
    console.log('Diamond cut executed successfully');
    console.log(`Transaction hash: ${tx.hash}`);

    // Print functions after upgrade
    console.log('Functions after upgrade:');
    await printFunctions(diamondProxyAddress);

    // Update the deployment record to point to the new facet
    const newFacetFactoryForSave = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    await deployments.save('IexecPocoAccessorsFacet', {
        abi: newFacetFactoryForSave.interface.fragments as any,
        address: updatedFacetAddress,
        bytecode: newFacetFactoryForSave.bytecode,
    });

    console.log('Proxy update completed successfully!');
    console.log(`New IexecPocoAccessorsFacet is now active at: ${updatedFacetAddress}`);
    console.log('');
    console.log('Summary of changes:');
    console.log(
        '  ✓ Completely removed facets containing legacy accessor functions (balanceOf, name, etc.)',
    );
    console.log(
        '  ✓ Selectively removed automatic getters from public constants (CONTRIBUTION_DEADLINE_RATIO, etc.)',
    );
    console.log('  ✓ KEPT legacy ABI accessor functions in IexecAccessorsABILegacyFacet');
    console.log('  ✓ Added explicit getter functions for internal constants');
    console.log('  ✓ Added new improved accessor functions');
    console.log('');
    console.log(
        'Note: Constants are now internal and accessible via explicit getter functions only.',
    );
})();
