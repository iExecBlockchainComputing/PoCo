// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { IexecPoco1Facet__factory, IexecPocoAccessorsFacet__factory } from '../../typechain';
import {
    deployFacets,
    linkNewFacetsToDiamond,
    printOnchainProxyFunctions,
    removeFacetsFromDiamond,
    removeFunctionsFromDiamond,
} from '../../utils/proxy-tools';
import { tryVerify } from '../verify';
import { FacetDetails, getUpgradeContext } from '../../utils/proxy-tools';
import { isArbitrumFork } from '../../utils/config';

async function main() {
    console.log('Starting bulk processing upgrade...');
    const { chainId, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    const facetAddressesPerChain: { [key: string]: { [key: string]: string } } = {
        // Arbitrum sepolia
        '421614': {
            IexecAccessorsFacet: '0xEa232be31ab0112916505Aeb7A2a94b5571DCc6b',
            IexecPocoAccessorsFacet: '0x6C56FFFd001939d03779929702B2722C904a34da',
            IexecPoco1Facet: '0xB670bf6165f1Df353CeA45AFB622dd91EA973AB9',
        },
        // Arbitrum mainnet
        '42161': {
            IexecAccessorsFacet: '0xEa232be31ab0112916505Aeb7A2a94b5571DCc6b',
            IexecPocoAccessorsFacet: '0xeb40697b275413241d9b31dE568C98B3EA12FFF0',
            IexecPoco1Facet: '0x46b555fE117DFd8D4eAC2470FA2d739c6c3a0152',
        },
    };

    const facetsToRemove: FacetDetails[] = [
        {
            name: 'IexecAccessorsFacet',
            address: facetAddressesPerChain[chainId.toString()]['IexecAccessorsFacet'],
            factory: null,
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: facetAddressesPerChain[chainId.toString()]['IexecPocoAccessorsFacet'],
            factory: null,
        },
        {
            name: 'IexecPoco1Facet',
            address: facetAddressesPerChain[chainId.toString()]['IexecPoco1Facet'],
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
        // Remove these functions from Arbitrum Mainnet.
        // The same functions are deployed within IexecAccessorsFacet
        // on Arbitrum Sepolia so they are automatically removed in
        // `removeFacetsFromDiamond`.
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

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
