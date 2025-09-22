// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../../../typechain';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../../typechain';
import { Ownable__factory } from '../../../typechain/factories/rlc-faucet-contract/contracts';
import config from '../../../utils/config';
import { getFunctionSelectors } from '../../../utils/proxy-tools';
import { printFunctions } from '../upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;

    console.log('Updating diamond proxy with new IexecPocoAccessorsFacet...');
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

    const updatedFacetAddress = (await deployments.get('IexecPocoAccessorsFacet')).address;
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

    const accessorFunctionSignatures = [
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

    const specificFunctionSignature = '0x66517ca6'; // ComputeDealVolume

    // Find the current accessor facet in the diamond (the one with 32 functions)
    for (const facet of facets) {
        const hasAccessorFunctions = facet.functionSelectors.some((selector) =>
            accessorFunctionSignatures.includes(selector),
        );
        if (hasAccessorFunctions) {
            oldAccessorFacets.add(facet.facetAddress);
        }

        const hasSpecificFunction = facet.functionSelectors.includes(specificFunctionSignature);
        if (hasSpecificFunction) {
            oldAccessorFacets.add(facet.facetAddress);
        }
    }

    // Find functions that need to be removed - ALL functions from old accessor facets
    const functionsToRemoveByFacet = new Map<string, string[]>();

    // Remove ALL functions from the old accessor facets
    for (const facet of facets) {
        if (oldAccessorFacets.has(facet.facetAddress)) {
            console.log(
                `Found old accessor facet ${facet.facetAddress} with ${facet.functionSelectors.length} functions - will remove ALL`,
            );
            functionsToRemoveByFacet.set(facet.facetAddress, [...facet.functionSelectors]);
        }
    }

    // Functions to add - ALL functions from the new facet, but exclude any that exist in other (non-accessor) facets
    const newFacetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const allNewFunctionSelectors = getFunctionSelectors(newFacetFactory);

    const functionsInOtherFacets = new Set<string>();
    for (const facet of facets) {
        // Skip old accessor facets (we're removing them) and the updated facet (if it already exists)
        if (
            !oldAccessorFacets.has(facet.facetAddress) &&
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

    console.log(`Functions skipped (exist in other facets): ${functionsInOtherFacets.size}`);
    console.log(`Functions to add to new facet: ${newFunctionSelectors.length}`);

    const facetCuts: IDiamond.FacetCutStruct[] = [];
    // Remove all functions from old accessor facets
    for (const [, selectors] of functionsToRemoveByFacet) {
        if (selectors.length > 0) {
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
})();
