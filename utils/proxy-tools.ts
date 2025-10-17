// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, FunctionFragment, Interface, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCut, FacetCutAction } from 'hardhat-deploy/dist/types';
import {
    DiamondCutFacet,
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    OwnershipFacet__factory,
    IexecAccessorsABILegacyFacet__factory,
    IexecCategoryManagerFacet__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecERC20Facet__factory,
    IexecEscrowNativeFacet__factory,
    IexecEscrowTokenFacet__factory,
    IexecEscrowTokenSwapFacet__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet__factory,
    IexecRelayFacet__factory,
} from '../typechain';
import { getBaseNameFromContractFactory } from '../utils/deploy-tools';

const POCO_STORAGE_LOCATION = '0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00';

/**
 * Get the slot location of a storage variable in the `PocoStorage` struct.
 * @param offset The offset to add to the base location.
 * @returns The storage slot location as a hexadecimal string.
 */
export function getPocoStorageSlotLocation(offset: bigint): string {
    return ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + offset);
}

/**
 * Link a contract to a Diamond proxy.
 * @param proxy contract to Diamond proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
export async function linkContractToProxy(
    proxy: DiamondCutFacet,
    contractAddress: string,
    contractFactory: ContractFactory,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    console.log(`Linking ${contractName} to proxy`);
    // Fetch existing selectors from the proxy.
    const existingSelectors = await DiamondLoupeFacet__factory.connect(
        await proxy.getAddress(),
        ethers.provider,
    )
        .facets()
        .then((facets) => facets.flatMap((facet) => facet.functionSelectors));
    // Get the contract selectors from its ABI.
    const contractSelectors = getFunctionSelectors(contractFactory);
    // Exclude existing selectors to avoid the error `CannotAddFunctionToDiamondThatAlreadyExists`.
    // This appears for `owner()` function for example.
    const selectors = contractSelectors.filter((selector) => !existingSelectors.includes(selector));
    const facetCut: FacetCut = {
        facetAddress: contractAddress,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
    };
    await proxy
        .diamondCut([facetCut], ZeroAddress, '0x')
        .then((tx) => tx.wait())
        .catch((err) => {
            console.log(`Failed to link ${contractName} to proxy:`);
            throw err;
        });
}

/**
 * Gets formatted function signatures from a contract's ABI.
 * @param contractFactory - The deployed contract instance
 * @returns Array of function signatures
 */
export function getFunctionSignatures(contractFactory: ContractFactory): string[] {
    return contractFactory.interface.fragments // Get all fragments from the contract's ABI
        .filter((f) => f.type === 'function' || f.type === 'fallback') // function + fallback + receive
        .map((f) => f.format()); // Format them to get clean function signatures
}

/**
 * Gets function selectors from a contract's ABI.
 * @param contract - The deployed contract instance
 * @returns Array of function selectors with utility methods
 */
export function getFunctionSelectors(contractFactory: ContractFactory): string[] {
    return (
        getFunctionSignatures(contractFactory) // Get all function signatures from the contract's ABI
            // Get the 4-byte function selectors
            .map((functionName) => {
                if (functionName === 'receive() payable') {
                    return '0x00000000'; // Receive function selector
                }
                if (functionName === 'fallback() payable') {
                    return '0xffffffff'; // Fallback function selector
                }
                return contractFactory.interface.getFunction(functionName)!.selector;
            })
    );
}

export function getAllLocalFacetFunctions(): Map<string, string> {
    // TODO update this when new facets are added.
    // TODO read facets folder to avoid manual updates.
    const allInterfaces: Interface[] = [
        DiamondCutFacet__factory.createInterface(),
        DiamondLoupeFacet__factory.createInterface(),
        OwnershipFacet__factory.createInterface(),
        IexecAccessorsABILegacyFacet__factory.createInterface(),
        IexecCategoryManagerFacet__factory.createInterface(),
        IexecConfigurationExtraFacet__factory.createInterface(),
        IexecConfigurationFacet__factory.createInterface(),
        IexecERC20Facet__factory.createInterface(),
        IexecEscrowNativeFacet__factory.createInterface(),
        IexecEscrowTokenFacet__factory.createInterface(),
        IexecEscrowTokenSwapFacet__factory.createInterface(),
        IexecOrderManagementFacet__factory.createInterface(),
        IexecPoco1Facet__factory.createInterface(),
        IexecPoco2Facet__factory.createInterface(),
        IexecPocoAccessorsFacet__factory.createInterface(),
        IexecPocoBoostAccessorsFacet__factory.createInterface(),
        IexecPocoBoostFacet__factory.createInterface(),
        IexecRelayFacet__factory.createInterface(),
    ];
    // TODO update `getFunctionSelectors` and use it here to avoid duplication.
    const fragments: [string, string][] = allInterfaces
        .flatMap((iface) => iface.fragments)
        .filter((fragment) => fragment.type === 'function')
        .map((fragment) => fragment as FunctionFragment)
        .map((fragment) => [fragment.selector, fragment.name] as [string, string])
        .concat([
            ['receive', '0x00000000'], // fragment.type is 'fallback'
            ['fallback', '0xffffffff'], // fragment.type is 'fallback'
        ]);
    const selectorToName = new Map<string, string>(fragments);
    return selectorToName;
}

export async function printOnchainProxyFunctions(diamondProxyAddress: string) {
    const selectorToName = getAllLocalFacetFunctions();
    const facets = await DiamondLoupeFacet__factory.connect(
        diamondProxyAddress,
        ethers.provider,
    ).facets();

    let totalFunctions = 0;
    facets.forEach((facet) => {
        totalFunctions += facet.functionSelectors.length;
    });
    console.log(`Diamond proxy supports ${totalFunctions} functions:`);

    let i = 0;
    for (const facet of facets) {
        for (const selector of facet.functionSelectors) {
            // Fallback to the selector if the name is not found.
            const functionName = selectorToName.get(selector) ?? selector;
            console.log(`[${i}] ${facet.facetAddress} ${functionName}`);
            i++;
        }
    }
}
