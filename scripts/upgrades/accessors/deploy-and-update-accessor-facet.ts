// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../../../typechain';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../../typechain';
import { Ownable__factory } from '../../../typechain/factories/rlc-faucet-contract/contracts';
import { FactoryDeployer } from '../../../utils/FactoryDeployer';
import config from '../../../utils/config';
import { mineBlockIfOnLocalFork } from '../../../utils/mine';
import { getFunctionSelectors } from '../../../utils/proxy-tools';
import { printFunctions } from '../upgrade-helper';

(async () => {
    console.log('Deploying and updating IexecPocoAccessorsFacet...');
    await mineBlockIfOnLocalFork();

    const [account] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;

    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }

    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Network: ${chainId}`);
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);

    console.log('\n=== Step 1: Deploying new IexecPocoAccessorsFacet ===');
    const factoryDeployer = new FactoryDeployer(account, chainId);
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    const facetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const updatedFacetAddress = await factoryDeployer.deployContract(facetFactory);
    console.log(`IexecPocoAccessorsFacet deployed at: ${updatedFacetAddress}`);

    console.log('\n=== Step 2: Updating diamond proxy with new facet ===');

    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondProxyAddress, account);
    const facets = await diamondLoupe.facets();

    console.log('\nCurrent facets in diamond:');
    facets.forEach((facet) => {
        console.log(`  ${facet.facetAddress}: ${facet.functionSelectors.length} functions`);
    });

    // Find the specific old accessor facets to remove completely
    const oldAccessorFacets = new Set<string>([
        '0xEa232be31ab0112916505Aeb7A2a94b5571DCc6b', //IexecAccessorsFacet
        '0xeb40697b275413241d9b31dE568C98B3EA12FFF0', //IexecPocoAccessorsFacet
    ]);

    // Specific constant getter functions to remove from facet
    const constantFacetAddress = '0x56CDC32332648b1220a89172191798852706EB35'; // IexecAccessorsABILegacyFacet
    const constantFunctionSignatures = [
        'CONTRIBUTION_DEADLINE_RATIO()',
        'FINAL_DEADLINE_RATIO()',
        'GROUPMEMBER_PURPOSE()',
        'KITTY_ADDRESS()',
        'KITTY_MIN()',
        'KITTY_RATIO()',
        'REVEAL_DEADLINE_RATIO()',
        'WORKERPOOL_STAKE_RATIO()',
    ];
    const constantFunctionsToRemove = constantFunctionSignatures.map((sig) =>
        ethers.id(sig).slice(0, 10),
    );

    // Find functions that need to be removed - ALL functions from old accessor facets + specific constants
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

    // Remove specific constant functions from the constants facet
    for (const facet of facets) {
        if (facet.facetAddress === constantFacetAddress) {
            const functionsToRemove = facet.functionSelectors.filter((selector) =>
                constantFunctionsToRemove.includes(selector),
            );
            if (functionsToRemove.length > 0) {
                console.log(
                    `Found constants facet ${facet.facetAddress} - will remove ${functionsToRemove.length} specific constant functions`,
                );
                functionsToRemoveByFacet.set(facet.facetAddress, functionsToRemove);
            }
            break;
        }
    }

    // Functions to add - ALL functions from the new facet, but exclude any that exist in other (non-accessor) facets
    const newFacetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const allNewFunctionSelectors = getFunctionSelectors(newFacetFactory);

    const functionsInOtherFacets = new Set<string>();
    for (const facet of facets) {
        // Skip old accessor facets (we're removing them), the constants facet (we're removing specific functions), and the updated facet (if it already exists)
        if (
            !oldAccessorFacets.has(facet.facetAddress) &&
            facet.facetAddress !== constantFacetAddress &&
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
    // Remove functions from facets (both old accessor facets and specific constants)
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

    console.log('Functions after upgrade:');
    await printFunctions(diamondProxyAddress);

    console.log('\nUpgrade completed successfully!');
    console.log(`New IexecPocoAccessorsFacet deployed at: ${updatedFacetAddress}`);
    console.log('Diamond proxy updated with new facet');
})();
