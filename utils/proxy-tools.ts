// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import {
    DiamondCutFacet,
    DiamondInit__factory,
    DiamondLoupeFacet,
    DiamondLoupeFacet__factory,
} from '../typechain';
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
    diamondInitAddress: string,
    contractAddress: string,
    contractFactory: any,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    const diamondLoupeFacet: DiamondLoupeFacet = DiamondLoupeFacet__factory.connect(
        await proxy.getAddress(),
        ethers.provider,
    );
    const abi = contractFactory.constructor.abi;
    const iface = new ethers.Interface(abi);
    let signatures = getFunctionSignatures(abi);
    console.log(`${contractName}:`);
    console.log(signatures);
    let selectors: string[] = signatures.map((functionName) => getFunctionSelector(functionName));
    // Skip following block if loupe is not yet present
    if (contractName != 'DiamondLoupeFacet') {
        const facets = await diamondLoupeFacet.facets();
        // Get selectors already set on diamond
        let existingSelectors: string[] = [];
        for (const facet of facets) {
            existingSelectors = existingSelectors.concat(facet.functionSelectors);
        }
        // Do no add a function whose name is already present on diamond [TODO: Improve]
        selectors = selectors.filter((selector) => {
            const existingSelector = existingSelectors.includes(selector);
            if (existingSelector) {
                console.log(
                    `[warn] ${contractName}.${iface.getFunction(selector)?.format()} won't be added (function name already set by other facet)`,
                );
            }
            return !existingSelector;
        });
    }
    await proxy
        .diamondCut(
            [
                {
                    facetAddress: contractAddress,
                    action: 0, // Add
                    functionSelectors: selectors,
                },
            ],
            diamondInitAddress,
            DiamondInit__factory.createInterface().encodeFunctionData('init'),
        )
        .then((tx) => tx.wait())
        .catch(() => {
            throw new Error(`Failed to link ${contractName}`);
        });
}

function getSerializedObject(entry: AbiParameter): string {
    return entry.type === 'tuple'
        ? `(${entry.components?.map(getSerializedObject).join(',') ?? ''})`
        : entry.type;
}

// TODO: Use contractFactory.interface.functions when moving to ethers@v6
// https://github.com/ethers-io/ethers.js/issues/1069
function getFunctionSignatures(abi: any[]): string[] {
    return [
        ...abi.filter((entry) => entry.type === 'receive').map(() => 'receive'),
        ...abi.filter((entry) => entry.type === 'fallback').map(() => 'fallback'),
        ...abi
            .filter((entry) => entry.type === 'function')
            .map(
                (entry) =>
                    `${entry.name}(${entry.inputs?.map(getSerializedObject).join(',') ?? ''})`,
            ),
    ].filter(Boolean);
}

function getFunctionSelector(functionName: string) {
    let selector = '';
    if (functionName == 'receive') {
        selector = '0x00000000';
    } else if (functionName == 'fallback') {
        selector = '0xFFFFFFFF';
    } else {
        selector = ethers.dataSlice(ethers.id(functionName), 0, 4);
    }
    return selector;
}
