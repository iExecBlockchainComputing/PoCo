// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataEncoder } from 'ethers';

const TYPES =  {
    EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
    ],
    AppOrder: [
        { name: 'app', type: 'address' },
        { name: 'appprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'datasetrestrict', type: 'address' },
        { name: 'workerpoolrestrict', type: 'address' },
        { name: 'requesterrestrict', type: 'address' },
        { name: 'salt', type: 'bytes32' }
    ],
    DatasetOrder: [
        { name: 'dataset', type: 'address' },
        { name: 'datasetprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'apprestrict', type: 'address' },
        { name: 'workerpoolrestrict', type: 'address' },
        { name: 'requesterrestrict', type: 'address' },
        { name: 'salt', type: 'bytes32' }
    ],
    WorkerpoolOrder: [
        { name: 'workerpool', type: 'address' },
        { name: 'workerpoolprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'category', type: 'uint256' },
        { name: 'trust', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'apprestrict', type: 'address' },
        { name: 'datasetrestrict', type: 'address' },
        { name: 'requesterrestrict', type: 'address' },
        { name: 'salt', type: 'bytes32' }
    ],
    RequestOrder: [
        { name: 'requester', type: 'address' },
        { name: 'beneficiary', type: 'address' },
        { name: 'app', type: 'address' },
        { name: 'tag', type: 'bytes32' },
        { name: 'dataset', type: 'address' },
        { name: 'appmaxprice', type: 'uint256' },
        { name: 'datasetmaxprice', type: 'uint256' },
        { name: 'workerpoolmaxprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'category', type: 'uint256' },
        { name: 'trust', type: 'uint256' },
        { name: 'callback', type: 'address' },
        { name: 'params', type: 'string' },
        { name: 'salt', type: 'bytes32' }
    ],
    AppOrderOperation: [
        { type: 'AppOrder', name: 'order' },
        { type: 'uint256', name: 'operation' },
    ],
    DatasetOrderOperation: [
        { type: 'DatasetOrder', name: 'order' },
        { type: 'uint256', name: 'operation' },
    ],
    WorkerpoolOrderOperation: [
        { type: 'WorkerpoolOrder', name: 'order' },
        { type: 'uint256', name: 'operation' },
    ],
    RequestOrderOperation: [
        { type: 'RequestOrder', name: 'order' },
        { type: 'uint256', name: 'operation' },
    ],
};

// Build EIP-712 types for an order
export function buildTypes(primaryType) {
    const OPERATION = 'Operation';
    const types = {
        [primaryType]: TYPES[primaryType],
    };

    // Check if primaryType ends with 'Operation'
    if (primaryType.endsWith(OPERATION)) {
        const referredType = primaryType.slice(0, -OPERATION.length);
        types[referredType] = TYPES[referredType];
    }

    return types;
}

async function eth_signTypedData(
    primaryType,
    message,
    domain,
    signer,
) {
    return new Promise((resolve, reject) => {
        const typedDataDomain = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract,
        };
        const types = buildTypes(primaryType);

        return signer.signTypedData(typedDataDomain, types, message).then(resolve).catch(reject);
    });
}

export async function signStruct(
    primaryType,
    message,
    domain,
    wallet,
) {
    return eth_signTypedData(primaryType, message, domain, wallet).then((sign) => {
        message.sign = sign;
        return message;
    });
}

export function hashStruct(
    primaryType,
    message,
    domain,
) {
    const typedDataDomain = {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract,
    };
    const types = {
        [primaryType]: TYPES[primaryType],
    };

    return TypedDataEncoder.hash(typedDataDomain, types, message);
}
