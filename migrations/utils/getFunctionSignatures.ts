// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

interface AbiParameter {
    type: string;
    components?: AbiParameter[];
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
