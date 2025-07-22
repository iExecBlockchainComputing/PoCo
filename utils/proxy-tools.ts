// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import { DiamondCutFacet, DiamondLoupeFacet__factory } from '../typechain';
import { getBaseNameFromContractFactory } from '../utils/deploy-tools';
import { FunctionFragment, ZeroAddress } from 'ethers';

interface AbiParameter {
    type: string;
    components?: AbiParameter[];
}

export enum FacetCutAction {
    Add = 0,
    Replace = 1,
    Remove = 2,
}

// Interface for a facet cut operation
export interface FacetCut {
    facetAddress: string;
    action: FacetCutAction;
    functionSelectors: string[];
}

/**
 * Link a contract to an ERC1538 proxy.
 * @param proxy contract to ERC1538 proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
export async function linkContractToProxy(
    proxy: DiamondCutFacet,
    contractAddress: string,
    contractFactory: any,
) {
    // Fetch existing selectors from the proxy.
    const existingSelectors = await DiamondLoupeFacet__factory.connect(
        await proxy.getAddress(),
        ethers.provider,
    )
        .facets()
        .then((facets) => facets.flatMap((facet) => facet.functionSelectors));
    // Get the contract selectors from its ABI.
    const contractName = getBaseNameFromContractFactory(contractFactory);
    const contractSelectors = await getSelectors(contractName, contractAddress);
    // Exclude existing selectors to avoid the error `CannotAddFunctionToDiamondThatAlreadyExists`.
    // This appears for `owner()` function.
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

function getSerializedObject(entry: AbiParameter): string {
    return entry.type === 'tuple'
        ? `(${entry.components?.map(getSerializedObject).join(',') ?? ''})`
        : entry.type;
}

function getFunctionSignatures(abi: any[]): string {
    return [
        ...abi.filter((entry) => entry.type === 'receive').map(() => 'receive;'),
        ...abi.filter((entry) => entry.type === 'fallback').map(() => 'fallback;'),
        ...abi
            .filter((entry) => entry.type === 'function')
            .map(
                (entry) =>
                    `${entry.name}(${entry.inputs?.map(getSerializedObject).join(',') ?? ''});`,
            ),
    ]
        .filter(Boolean)
        .join('');
}

/**
 * Gets function selectors from a contract's ABI.
 * Filters out the 'init(bytes)' function.
 * @param contract - The deployed contract instance
 * @returns Array of function selectors with utility methods
 */
// TODO check for `receive` and `fallback` functions.
export async function getSelectors(facetName: string, facetAddress: string): Promise<string[]> {
    const facetContract = await ethers.getContractAt(facetName, facetAddress);
    return (
        facetContract.interface.fragments // Get all fragments from the contract's ABI
            .filter((f) => f.type === 'function') // Filter only function fragments
            .map((f) => FunctionFragment.from(f)) // Convert to FunctionFragment
            .map((f) => f.format()) // Format them to get clean function signatures
            // Exclude the 'init()' function if not in the DiamondInit facet.
            .filter((val) => !(facetName !== 'DiamondInit' && val === 'init()'))
            // .map((f) => {
            //     console.log(facetName, ':', f); // Log the function names
            //     return f;
            // })
            // Get the 4-byte function selectors
            .map((val) => facetContract.interface.getFunction(val)!.selector)
    );
}
