// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCut, FacetCutAction } from 'hardhat-deploy/dist/types';
import { DiamondCutFacet, DiamondLoupeFacet__factory } from '../typechain';
import { getBaseNameFromContractFactory } from '../utils/deploy-tools';

interface AbiParameter {
    type: string;
    components?: AbiParameter[];
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
    contractFactory: ContractFactory,
) {
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
            const contractName = getBaseNameFromContractFactory(contractFactory);
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
