// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { FunctionFragment } from 'ethers';
import { IexecPoco1Facet__factory, IexecPocoAccessorsFacet__factory } from '../../typechain';
import {
    deployFacets,
    FacetDetails,
    getUpgradeContext,
    linkFacetsToDiamond,
    printOnchainProxyFunctions,
    removeFacetsFromDiamond,
    removeFunctionsFromDiamond,
} from '../../utils/proxy-tools';
import { tryVerify } from '../verify';
import { isArbitrumFork, isArbitrumSepoliaFork } from '../../utils/config';

async function main() {
    console.log('Performing bulk processing upgrade...');
    const { chainId, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    // TODO read addresses from deployments.
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
            name: 'IexecPoco1Facet',
            address: facetAddressesPerChain[chainId.toString()]['IexecPoco1Facet'],
            factory: null,
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: facetAddressesPerChain[chainId.toString()]['IexecPocoAccessorsFacet'],
            factory: null,
        },
    ];
    if (isArbitrumSepoliaFork() || chainId == 421614n) {
        // On Arbitrum Sepolia, also remove Boost facets.
        facetsToRemove.push(
            {
                name: 'IexecPocoBoostAccessorsFacet',
                address: '0xa23ABb680ecc9D2A51a0CcDE88604552340786Ae',
                factory: null,
            },
            {
                name: 'IexecPocoBoostFacet',
                address: '0x248df8EFE953B39f965e5C7272283096d20f5956',
                factory: null,
            },
        );
    }

    const facetsToAdd: FacetDetails[] = [
        {
            name: 'IexecPoco1Facet',
            address: null,
            factory: new IexecPoco1Facet__factory(iexecLibOrders),
        },
        {
            name: 'IexecPocoAccessorsFacet',
            address: null,
            factory: new IexecPocoAccessorsFacet__factory(iexecLibOrders),
        },
    ];
    await deployFacets(deployer, chainId, facetsToAdd); // Adds deployed addresses to `facetsToAdd`.
    await printOnchainProxyFunctions(proxyAddress);
    await removeFacetsFromDiamond(proxyAddress, proxyOwner, facetsToRemove);
    if (isArbitrumFork() || chainId == 42161n) {
        // Remove these functions from Arbitrum Mainnet without completely removing their facet.
        // On Arbitrum Mainnet, they were deployed in `IexecAccessorsABILegacyFacet`.
        // On Arbitrum Sepolia, they were deployed in `IexecAccessorsFacet` so no need
        // to remove them manually since the facet is removed in `removeFacetsFromDiamond`.
        const functionSignatures = [
            FunctionFragment.from('function CONTRIBUTION_DEADLINE_RATIO() view returns (uint256)'),
            FunctionFragment.from('function FINAL_DEADLINE_RATIO() view returns (uint256)'),
            FunctionFragment.from('function GROUPMEMBER_PURPOSE() view returns (uint256)'),
            FunctionFragment.from('function KITTY_ADDRESS() view returns (address)'),
            FunctionFragment.from('function KITTY_MIN() view returns (uint256)'),
            FunctionFragment.from('function KITTY_RATIO() view returns (uint256)'),
            FunctionFragment.from('function REVEAL_DEADLINE_RATIO() view returns (uint256)'),
            FunctionFragment.from('function WORKERPOOL_STAKE_RATIO() view returns (uint256)'),
        ];
        await removeFunctionsFromDiamond(proxyAddress, proxyOwner, functionSignatures);
    }
    await printOnchainProxyFunctions(proxyAddress);
    await linkFacetsToDiamond(proxyAddress, proxyOwner, facetsToAdd);
    await printOnchainProxyFunctions(proxyAddress);
    console.log('Upgrade performed successfully!');
    // TODO pass only name as argument and get address from deployments.
    await tryVerify(facetsToAdd as { name: string; address: string }[]);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
