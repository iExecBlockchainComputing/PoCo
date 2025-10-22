// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../../typechain';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPoco1Facet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../typechain';
import { FactoryDeployer } from '../../utils/FactoryDeployer';
import { linkContractToProxy, printOnchainProxyFunctions } from '../../utils/proxy-tools';
import { tryVerify } from '../verify';
import { FacetDetails, getUpgradeContext } from './upgrade-helper';
import { isArbitrumFork } from '../../utils/config';

async function main() {
    console.log('Starting bulk processing upgrade...');
    const { chainId, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    const facetsToRemove: FacetDetails[] = [
        {
            name: 'IexecAccessorsFacet',
            address: '0xEa232be31ab0112916505Aeb7A2a94b5571DCc6b',
            factory: null,
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: '0xeb40697b275413241d9b31dE568C98B3EA12FFF0',
            factory: null,
        },
        {
            name: 'IexecPoco1Facet',
            address: '0x46b555fE117DFd8D4eAC2470FA2d739c6c3a0152',
            factory: null,
        },
    ];

    const facetsToAdd: FacetDetails[] = [
        {
            name: 'IexecPocoAccessorsFacet',
            address: null,
            factory: new IexecPocoAccessorsFacet__factory(iexecLibOrders),
        },
        {
            name: 'IexecPoco1Facet',
            address: null,
            factory: new IexecPoco1Facet__factory(iexecLibOrders),
        },
    ];

    // This will add the address of each deployed facet to `facetsToAdd` array.
    await printOnchainProxyFunctions(proxyAddress);
    await deployFacets(deployer, chainId, facetsToAdd);
    await removeFacetsFromDiamond(proxyAddress, proxyOwner, facetsToRemove);
    await printOnchainProxyFunctions(proxyAddress);
    await linkNewFacetsToDiamond(proxyAddress, proxyOwner, facetsToAdd);
    await printOnchainProxyFunctions(proxyAddress);

    if (isArbitrumFork() || chainId == 42161n) {
        // constant functions are deployed within IexecAccessorsFacet on arbitrum sepolia
        const functionSignatures = [
            'CONTRIBUTION_DEADLINE_RATIO()',
            'FINAL_DEADLINE_RATIO()',
            'GROUPMEMBER_PURPOSE()',
            'KITTY_ADDRESS()',
            'KITTY_MIN()',
            'KITTY_RATIO()',
            'REVEAL_DEADLINE_RATIO()',
            'WORKERPOOL_STAKE_RATIO()',
        ];
        await removeFunctionsFromDiamond(proxyAddress, proxyOwner, functionSignatures);
        await printOnchainProxyFunctions(proxyAddress);
    }
    console.log('Upgrade applied successfully!');

    // await tryVerify([
    //     {
    //         name: 'IexecPocoAccessorsFacet',
    //         address: iexecPocoAccessorsFacet,
    //         constructorArguments: [],
    //     },
    //     {
    //         name: 'IexecPoco1Facet',
    //         address: newIexecPoco1Facet,
    //         constructorArguments: [],
    //     },
    // ]);
}

async function deployFacets(
    deployer: SignerWithAddress,
    chainId: bigint,
    facetDetails: FacetDetails[],
) {
    console.log('\n=== Deploying new facets ===');
    const factoryDeployer = new FactoryDeployer(deployer, chainId);
    for (const facet of facetDetails) {
        const facetAddress = await factoryDeployer.deployContract(facet.factory!);
        facet.address = facetAddress;
    }
    return facetDetails;
}

async function removeFacetsFromDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    facets: FacetDetails[],
) {
    console.log('\n=== Removing whole facets from diamond ===');
    const diamondLoupe = DiamondLoupeFacet__factory.connect(proxyAddress, ethers.provider);
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    const facetCuts: IDiamond.FacetCutStruct[] = [];
    for (const facet of facets) {
        const selectors = await diamondLoupe.facetFunctionSelectors(facet.address!);
        if (selectors.length > 0) {
            console.log(
                `Will remove the whole facet ${facet.name} [address: ${facet.address}, functions:${selectors.length}]`,
            );
            facetCuts.push({
                facetAddress: ZeroAddress,
                action: FacetCutAction.Remove,
                functionSelectors: [...selectors],
            });
        } else {
            console.log(`Skipping empty facet ${facet.name} [address: ${facet.address}]`);
        }
    }
    if (facetCuts.length === 0) {
        throw new Error('No facets to remove');
    }
    console.log(`Executing diamond cut to remove ${facetCuts.length} facets`);
    // facetCuts.forEach((cut, index) => {
    //     console.log(`  Cut ${index + 1}: Remove ${cut.functionSelectors.length} functions`);
    // });
    const tx = await diamondCutAsOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log('Facets removed successfully!');
}

async function linkNewFacetsToDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    facets: FacetDetails[],
) {
    console.log('\n=== Linking facets to diamond proxy ===');
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    for (const facet of facets) {
        if (!facet.address || !facet.factory) {
            throw new Error(`Cannot link facet ${facet.name} with null address or factory`);
        }
        await linkContractToProxy(diamondCutAsOwner, facet.address, facet.factory);
    }
    console.log('Facets linked successfully!');
}

async function removeFunctionsFromDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    functionSignatures: string[],
) {
    console.log('\n=== Removing specific functions from diamond ===');
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    console.log(`Removing ${functionSignatures.length} functions:`);
    functionSignatures.forEach((signature) => console.log(`  - ${signature}`));
    const functionSelectors = functionSignatures.map((sig) => ethers.id(sig).slice(0, 10));
    const facetCuts: IDiamond.FacetCutStruct[] = [];
    facetCuts.push({
        facetAddress: ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: functionSelectors,
    });
    const tx = await diamondCutAsOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log('Functions removed successfully!');
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
