// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {
    IexecAccessorsABILegacyFacet__factory,
    IexecCategoryManagerFacet__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecEscrowTokenFacet__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
    IexecRelayFacet__factory,
} from '../../typechain';
import {
    FacetDetails,
    deployFacets,
    getUpgradeContext,
    linkFacetsToDiamond,
    printOnchainDiamondDescription,
    removeDanglingFacetDeploymentArtifacts,
    removeFacetsFromDiamond,
    saveOnchainDiamondDescription,
} from '../../utils/proxy-tools';
import { tryVerify } from '../verify';

async function main() {
    console.log('Performing Solidity v8 migration upgrade (v6.2.0)...');
    const { chainId, networkName, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    // Define all facets to remove (all existing facets except core diamond facets)
    const facetAddressesPerChain: { [key: string]: { [key: string]: string } } = {
        // Arbitrum Sepolia
        '421614': {
            IexecAccessorsABILegacyFacet: '0x56CDC32332648b1220a89172191798852706EB35',
            IexecCategoryManagerFacet: '0x5f0483b9D7f959816A5CDD4C49E5C91C24561B43',
            IexecConfigurationExtraFacet: '0x7Ff117E7385Ac3E207AF1791fE7e66C7802aeCCd',
            IexecConfigurationFacet: '0x88eb05e62434057d3AA9e41FdaF7300A586b314D',
            IexecERC20Facet: '0xB0152eC6f48E64a92B66D4736aFA1b02d8D45169', // Removed from codebase
            IexecEscrowTokenFacet: '0xd9EB17A161581FBBAD2Ae998c0C19746EaAD0D6E',
            IexecOrderManagementFacet: '0x541d532E6C195Ba044a75325F367342f523627fB',
            IexecPoco1Facet: '0xC8dE3913fcdBC576970dCe24eE416CA25681f65f',
            IexecPoco2Facet: '0x5c7B589E6807B554ed278f335215B93bCB692162',
            IexecPocoAccessorsFacet: '0x56625089E6EB6F058DB163025318575AD38781fa',
            IexecRelayFacet: '0x8cBf58265F74b77f0D9cCA9f7e14685205496d8f',
        },
        // Arbitrum Mainnet
        '42161': {
            IexecAccessorsABILegacyFacet: '0x56CDC32332648b1220a89172191798852706EB35',
            IexecCategoryManagerFacet: '0x5f0483b9D7f959816A5CDD4C49E5C91C24561B43',
            IexecConfigurationExtraFacet: '0x7Ff117E7385Ac3E207AF1791fE7e66C7802aeCCd',
            IexecConfigurationFacet: '0x88eb05e62434057d3AA9e41FdaF7300A586b314D',
            IexecERC20Facet: '0xB0152eC6f48E64a92B66D4736aFA1b02d8D45169', // Removed from codebase
            IexecEscrowTokenFacet: '0xd9EB17A161581FBBAD2Ae998c0C19746EaAD0D6E',
            IexecOrderManagementFacet: '0x541d532E6C195Ba044a75325F367342f523627fB',
            IexecPoco1Facet: '0x5331c0FC7DD0Cc08047B546675cd1d6d47152AEb',
            IexecPoco2Facet: '0x5c7B589E6807B554ed278f335215B93bCB692162',
            IexecPocoAccessorsFacet: '0x9BCaCA06d5173f4bA02F8ECcb28E227333F1606F',
            IexecRelayFacet: '0x8cBf58265F74b77f0D9cCA9f7e14685205496d8f',
        },
    };

    const chainIdStr = chainId.toString();
    const addresses = facetAddressesPerChain[chainIdStr];
    if (!addresses) {
        throw new Error(`No facet addresses defined for chain ID ${chainId}`);
    }

    // Build list of facets to remove
    const facetsToRemove: FacetDetails[] = [
        {
            name: 'IexecAccessorsABILegacyFacet',
            address: addresses['IexecAccessorsABILegacyFacet'],
            factory: null,
        },
        {
            name: 'IexecCategoryManagerFacet',
            address: addresses['IexecCategoryManagerFacet'],
            factory: null,
        },
        {
            name: 'IexecConfigurationExtraFacet',
            address: addresses['IexecConfigurationExtraFacet'],
            factory: null,
        },
        {
            name: 'IexecConfigurationFacet',
            address: addresses['IexecConfigurationFacet'],
            factory: null,
        },
        {
            name: 'IexecERC20Facet',
            address: addresses['IexecERC20Facet'],
            factory: null,
        },
        {
            name: 'IexecEscrowTokenFacet',
            address: addresses['IexecEscrowTokenFacet'],
            factory: null,
        },
        {
            name: 'IexecOrderManagementFacet',
            address: addresses['IexecOrderManagementFacet'],
            factory: null,
        },
        {
            name: 'IexecPoco1Facet',
            address: addresses['IexecPoco1Facet'],
            factory: null,
        },
        {
            name: 'IexecPoco2Facet',
            address: addresses['IexecPoco2Facet'],
            factory: null,
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: addresses['IexecPocoAccessorsFacet'],
            factory: null,
        },
        {
            name: 'IexecRelayFacet',
            address: addresses['IexecRelayFacet'],
            factory: null,
        },
    ];

    // Build list of facets to add (all with Solidity v8)
    const facetsToAdd: FacetDetails[] = [
        {
            name: 'IexecAccessorsABILegacyFacet',
            address: null,
            factory: new IexecAccessorsABILegacyFacet__factory(), // TODO: Check with middleware team if this facet is still needed.
        },
        {
            name: 'IexecCategoryManagerFacet',
            address: null,
            factory: new IexecCategoryManagerFacet__factory(),
        },
        {
            name: 'IexecConfigurationExtraFacet',
            address: null,
            factory: new IexecConfigurationExtraFacet__factory(),
        },
        {
            name: 'IexecConfigurationFacet',
            address: null,
            factory: new IexecConfigurationFacet__factory(iexecLibOrders),
        },
        {
            name: 'IexecEscrowTokenFacet',
            address: null,
            factory: new IexecEscrowTokenFacet__factory(),
        },
        {
            name: 'IexecOrderManagementFacet',
            address: null,
            factory: new IexecOrderManagementFacet__factory(iexecLibOrders),
        },
        {
            name: 'IexecPoco1Facet',
            address: null,
            factory: new IexecPoco1Facet__factory(iexecLibOrders),
        },
        {
            name: 'IexecPoco2Facet',
            address: null,
            factory: new IexecPoco2Facet__factory(),
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: null,
            factory: new IexecPocoAccessorsFacet__factory(iexecLibOrders),
        },
        {
            name: 'IexecRelayFacet',
            address: null,
            factory: new IexecRelayFacet__factory(),
        },
    ];

    await printOnchainDiamondDescription(proxyAddress);
    await deployFacets(deployer, chainId, facetsToAdd);
    await removeFacetsFromDiamond(proxyAddress, proxyOwner, facetsToRemove);
    await printOnchainDiamondDescription(proxyAddress);
    await linkFacetsToDiamond(proxyAddress, proxyOwner, facetsToAdd);
    await printOnchainDiamondDescription(proxyAddress);
    console.log('Upgrade performed successfully!');
    await saveOnchainDiamondDescription(proxyAddress, networkName);
    await removeDanglingFacetDeploymentArtifacts(proxyAddress);
    await tryVerify(facetsToAdd.map((facet) => facet.name));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
