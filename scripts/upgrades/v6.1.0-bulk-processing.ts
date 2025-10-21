// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import type { DiamondCutFacet, IDiamond } from '../../typechain';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPoco1Facet__factory,
    IexecPocoAccessorsFacet__factory,
} from '../../typechain';
import { FactoryDeployer } from '../../utils/FactoryDeployer';
import { linkContractToProxy, printOnchainProxyFunctions } from '../../utils/proxy-tools';
import { tryVerify } from '../verify';
import { getUpgradeContext } from './upgrade-helper';
import { isArbitrumFork } from '../../utils/config';

async function main() {
    console.log('Starting bulk processing upgrade...');
    const { deployer, chainId, proxyAsOwner, iexecLibOrdersAddress } = await getUpgradeContext();
    console.log('Facets: IexecPocoAccessorsFacet & IexecPoco1Facet');

    const { iexecPocoAccessorsFacet, newIexecPoco1Facet } = await deployNewFacets(
        deployer,
        chainId,
        iexecLibOrdersAddress,
    );
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const iexecPocoAccessorsFacetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const newIexecPoco1FacetFactory = new IexecPoco1Facet__factory(iexecLibOrders);
    await removeOldFacetsFromDiamond(proxyAsOwner, chainId);
    await linkNewFacetsToDiamond(
        proxyAsOwner,
        iexecPocoAccessorsFacet,
        newIexecPoco1Facet,
        iexecPocoAccessorsFacetFactory,
        newIexecPoco1FacetFactory,
    );
    await tryVerify([
        {
            name: 'IexecPocoAccessorsFacet',
            address: iexecPocoAccessorsFacet,
            constructorArguments: [],
        },
        {
            name: 'IexecPoco1Facet',
            address: newIexecPoco1Facet,
            constructorArguments: [],
        },
    ]);
}

async function deployNewFacets(
    deployer: SignerWithAddress,
    chainId: bigint,
    iexecLibOrdersAddress: string,
) {
    console.log('\n=== Step 1: Deploying all new facets ===');
    const factoryDeployer = new FactoryDeployer(deployer, chainId);
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };

    console.log('Deploying new IexecPocoAccessorsFacet...');
    const iexecPocoAccessorsFacetFactory = new IexecPocoAccessorsFacet__factory(iexecLibOrders);
    const iexecPocoAccessorsFacet = await factoryDeployer.deployContract(
        new IexecPocoAccessorsFacet__factory(iexecLibOrders),
    );

    console.log('Deploying new IexecPoco1Facet...');
    const newIexecPoco1FacetFactory = new IexecPoco1Facet__factory(iexecLibOrders);
    const newIexecPoco1Facet = await factoryDeployer.deployContract(newIexecPoco1FacetFactory);
    return { iexecPocoAccessorsFacet, newIexecPoco1Facet };
}

async function removeOldFacetsFromDiamond(diamondProxyAsOwner: DiamondCutFacet, chainId: bigint) {
    const diamondProxyAddress = await diamondProxyAsOwner.getAddress();
    console.log(
        '\n=== Step 2: Remove old facets (IexecAccessorsFacet & IexecPocoAccessorsFacet & IexecPoco1Facet) ===',
    );

    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondProxyAddress, ethers.provider);
    const currentFacets = await diamondLoupe.facets();

    console.log('\nCurrent facets in diamond:');
    currentFacets.forEach((facet) => {
        console.log(`  ${facet.facetAddress}: ${facet.functionSelectors.length} functions`);
    });

    console.log('Diamond functions before upgrade:');
    await printOnchainProxyFunctions(diamondProxyAddress);

    const removalCuts: IDiamond.FacetCutStruct[] = [];

    // constant functions are deployed within IexecAccessorsFacet on arbitrum sepolia
    if (isArbitrumFork() || chainId == 42161n) {
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
        console.log(
            `Removing specific constant functions from diamond Proxy - will remove ${constantFunctionsToRemove.length} specific constant functions`,
        );
        removalCuts.push({
            facetAddress: ZeroAddress,
            action: FacetCutAction.Remove,
            functionSelectors: constantFunctionsToRemove,
        });
    }

    const oldFacets = [
        '0xEa232be31ab0112916505Aeb7A2a94b5571DCc6b', //IexecAccessorsFacet
        '0xeb40697b275413241d9b31dE568C98B3EA12FFF0', //IexecPocoAccessorsFacet
        '0x46b555fE117DFd8D4eAC2470FA2d739c6c3a0152', //IexecPoco1Facet
    ];
    // Remove ALL functions from the old facets using diamondLoupe.facetFunctionSelectors() except of constant founctions
    for (const facetAddress of oldFacets) {
        const selectors = await diamondLoupe.facetFunctionSelectors(facetAddress);
        if (selectors.length > 0) {
            console.log(
                `Removing old facet ${facetAddress} with ${selectors.length} functions - will remove ALL`,
            );
            removalCuts.push({
                facetAddress: ZeroAddress,
                action: FacetCutAction.Remove,
                functionSelectors: [...selectors],
            });
        }
    }

    if (removalCuts.length > 0) {
        console.log('Executing diamond cut to remove old functions...');
        console.log(`Removal cuts: ${removalCuts.length}`);
        removalCuts.forEach((cut, index) => {
            console.log(`  Cut ${index + 1}: Remove ${cut.functionSelectors.length} functions`);
        });

        const removeTx = await diamondProxyAsOwner.diamondCut(removalCuts, ZeroAddress, '0x');
        await removeTx.wait();
        console.log(`Transaction hash: ${removeTx.hash}`);
        console.log('Diamond functions after removing old facets:');
        await printOnchainProxyFunctions(diamondProxyAddress);
    }
}

async function linkNewFacetsToDiamond(
    diamondProxyAsOwner: DiamondCutFacet,
    iexecPocoAccessorsFacet: string,
    newIexecPoco1Facet: string,
    iexecPocoAccessorsFacetFactory: IexecPocoAccessorsFacet__factory,
    newIexecPoco1FacetFactory: IexecPoco1Facet__factory,
) {
    const diamondProxyAddress = await diamondProxyAsOwner.getAddress();
    console.log('\n=== Step 3: Updating diamond proxy with all new facets ===');
    console.log('Adding new IexecPocoAccessorsFacet...');
    await linkContractToProxy(
        diamondProxyAsOwner,
        iexecPocoAccessorsFacet,
        iexecPocoAccessorsFacetFactory,
    );
    console.log('New IexecPocoAccessorsFacet added successfully');

    console.log('Adding new IexecPoco1Facet ...');
    await linkContractToProxy(diamondProxyAsOwner, newIexecPoco1Facet, newIexecPoco1FacetFactory);
    console.log('New IexecPoco1Facet with assertDatasetDealCompatibility added successfully');

    console.log('Diamond functions after adding new facets:');
    await printOnchainProxyFunctions(diamondProxyAddress);

    console.log('\nUpgrade completed successfully!');
    console.log(`New IexecPocoAccessorsFacet deployed at: ${iexecPocoAccessorsFacet}`);
    console.log(`New IexecPoco1Facet deployed at: ${newIexecPoco1Facet}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
