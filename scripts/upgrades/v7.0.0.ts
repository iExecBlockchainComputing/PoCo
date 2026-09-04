// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {
    IexecCategoryManagerFacet__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecEscrowFacet__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
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
    console.log('Performing native mode removal and escrow consolidation upgrade (v7.0.0)...');
    const { chainId, networkName, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    /**
     * Facets replaced by this upgrade, at the addresses the v6.2.0 upgrade left
     * them on. Values are taken from `deployments/<network>/<facet>.json`. The v5
     * deployer uses CREATE2 with a constant salt, so both chains share the same
     * addresses.
     *
     * `IexecAccessorsABILegacyFacet` and `IexecRelayFacet` are unchanged.
     */
    const facetAddressesPerChain: { [key: string]: { [key: string]: string } } = {
        // Arbitrum Sepolia
        '421614': {
            IexecCategoryManagerFacet: '0x1E18624655a680dF645EF4668D303d0e158c3A23',
            IexecConfigurationExtraFacet: '0x704DD48dFd3123445eE7d71230D099ee5a7fF384',
            IexecConfigurationFacet: '0x860e131a34FAA9D2c80B5E5608026cf0885C4DD8',
            IexecEscrowTokenFacet: '0xCB012a87Df7106a155a2DbF63B32936625142319', // Renamed to IexecEscrowFacet
            IexecOrderManagementFacet: '0xe5e071d9956D650C9DF2231B3C24c929Ae8a6698',
            IexecPoco1Facet: '0x4F4fceE743Ff87a8e524F51B24FF33132e4d5F06',
            IexecPoco2Facet: '0x8C75D9a503Cba140a34CB42dB7020B1295cbe39C',
            IexecPocoAccessorsFacet: '0x4273B5c5f56416302a5FE0DDeB6d7272cDC7faeC',
        },
        // Arbitrum Mainnet
        '42161': {
            IexecCategoryManagerFacet: '0x1E18624655a680dF645EF4668D303d0e158c3A23',
            IexecConfigurationExtraFacet: '0x704DD48dFd3123445eE7d71230D099ee5a7fF384',
            IexecConfigurationFacet: '0x860e131a34FAA9D2c80B5E5608026cf0885C4DD8',
            IexecEscrowTokenFacet: '0xCB012a87Df7106a155a2DbF63B32936625142319', // Renamed to IexecEscrowFacet
            IexecOrderManagementFacet: '0xe5e071d9956D650C9DF2231B3C24c929Ae8a6698',
            IexecPoco1Facet: '0x4F4fceE743Ff87a8e524F51B24FF33132e4d5F06',
            IexecPoco2Facet: '0x8C75D9a503Cba140a34CB42dB7020B1295cbe39C',
            IexecPocoAccessorsFacet: '0x4273B5c5f56416302a5FE0DDeB6d7272cDC7faeC',
        },
    };

    const chainIdStr = chainId.toString();
    const addresses = facetAddressesPerChain[chainIdStr];
    if (!addresses) {
        throw new Error(`No facet addresses defined for chain ID ${chainId}`);
    }

    /**
     * Every changed PoCo facet is replaced. `IexecEscrowTokenFacet` is the only
     * one removed without a same-name replacement: the escrow is renamed to
     * `IexecEscrowFacet`.
     */
    const facetsToRemove: FacetDetails[] = [
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
    ];

    const facetsToAdd: FacetDetails[] = [
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
            name: 'IexecEscrowFacet',
            address: null,
            factory: new IexecEscrowFacet__factory(),
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
