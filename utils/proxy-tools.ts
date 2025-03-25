// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import {
    DiamondCutFacet,
    DiamondInit__factory,
    DiamondLoupeFacet,
    DiamondLoupeFacet__factory,
    IDiamondLoupe,
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
    let existingFacets: IDiamondLoupe.FacetStructOutput[] = [];
    try {
        // Get selectors already set on diamond
        existingFacets = await diamondLoupeFacet.facets();
        let existingSelectors: string[] = [];
        for (const facet of existingFacets) {
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
    } catch (e) {
        console.log('No selectors already set on diamond.');
    }
    const init = existingFacets.length == 0;
    // Multiple facets could be added to the proxy in a single transaction, but note that:
    // 0. Adding 1 facet at a time costs around 300K gas here.
    // 1. Adding all facets in a single transaction could cost around 5M gas here. It might
    //  not be that straightforward to get such big transaction mined on a public network.
    // 2. Adding couple facets in a single tx is another option with few tuning.
    // Let's use option 0 for now.
    await proxy
        .diamondCut(
            [
                {
                    facetAddress: contractAddress,
                    action: 0, // Add
                    functionSelectors: selectors,
                },
            ],
            init ? diamondInitAddress : ZeroAddress, // only trigger init when adding first facet
            init ? DiamondInit__factory.createInterface().encodeFunctionData('init') : '0x',
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
