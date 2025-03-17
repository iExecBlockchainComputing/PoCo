// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ERC1538Update } from '../typechain';
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
    proxy: ERC1538Update,
    contractAddress: string,
    contractFactory: any,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    await proxy
        .updateContract(
            contractAddress,
            // TODO: Use contractFactory.interface.functions when moving to ethers@v6
            // https://github.com/ethers-io/ethers.js/issues/1069
            getFunctionSignatures(contractFactory.constructor.abi),
            'Linking ' + contractName,
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

export function getFunctionSignatures(abi: any[]): string {
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
