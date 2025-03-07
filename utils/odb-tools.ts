// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AbstractSigner, TypedDataDomain, TypedDataEncoder, TypedDataField } from 'ethers';

interface WalletInfo {
    privateKey?: string;
    address?: string;
}

interface Types {
    [key: string]: Array<TypedDataField>;
}

const TYPES: Types = {
    EIP712Domain: [
        { type: 'string', name: 'name' },
        { type: 'string', name: 'version' },
        { type: 'uint256', name: 'chainId' },
        { type: 'address', name: 'verifyingContract' },
    ],
    AppOrder: [
        { type: 'address', name: 'app' },
        { type: 'uint256', name: 'appprice' },
        { type: 'uint256', name: 'volume' },
        { type: 'bytes32', name: 'tag' },
        { type: 'address', name: 'datasetrestrict' },
        { type: 'address', name: 'workerpoolrestrict' },
        { type: 'address', name: 'requesterrestrict' },
        { type: 'bytes32', name: 'salt' },
    ],
    DatasetOrder: [
        { type: 'address', name: 'dataset' },
        { type: 'uint256', name: 'datasetprice' },
        { type: 'uint256', name: 'volume' },
        { type: 'bytes32', name: 'tag' },
        { type: 'address', name: 'apprestrict' },
        { type: 'address', name: 'workerpoolrestrict' },
        { type: 'address', name: 'requesterrestrict' },
        { type: 'bytes32', name: 'salt' },
    ],
    WorkerpoolOrder: [
        { type: 'address', name: 'workerpool' },
        { type: 'uint256', name: 'workerpoolprice' },
        { type: 'uint256', name: 'volume' },
        { type: 'bytes32', name: 'tag' },
        { type: 'uint256', name: 'category' },
        { type: 'uint256', name: 'trust' },
        { type: 'address', name: 'apprestrict' },
        { type: 'address', name: 'datasetrestrict' },
        { type: 'address', name: 'requesterrestrict' },
        { type: 'bytes32', name: 'salt' },
    ],
    RequestOrder: [
        { type: 'address', name: 'app' },
        { type: 'uint256', name: 'appmaxprice' },
        { type: 'address', name: 'dataset' },
        { type: 'uint256', name: 'datasetmaxprice' },
        { type: 'address', name: 'workerpool' },
        { type: 'uint256', name: 'workerpoolmaxprice' },
        { type: 'address', name: 'requester' },
        { type: 'uint256', name: 'volume' },
        { type: 'bytes32', name: 'tag' },
        { type: 'uint256', name: 'category' },
        { type: 'uint256', name: 'trust' },
        { type: 'address', name: 'beneficiary' },
        { type: 'address', name: 'callback' },
        { type: 'string', name: 'params' },
        { type: 'bytes32', name: 'salt' },
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

export function buildTypes(primaryType: string): Types {
    const OPERATION = 'Operation';
    const types: Types = {
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
    primaryType: string,
    message: Record<string, any>,
    domain: TypedDataDomain,
    signer: AbstractSigner,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const typedDataDomain = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract,
        };
        const types = buildTypes(primaryType);

        let signerPromise;

        // if (signer.privateKey) {
        //     const walletInstance = new ethers.Wallet(signer.privateKey, hre.ethers.provider);
        //     signerPromise = Promise.resolve(walletInstance);
        // } else {
        //     if (signer.address) {
        //         signerPromise = hre.ethers.getSigner(signer.address);
        //     } else {
        //         reject(new Error('Wallet address is undefined'));
        //         return;
        //     }
        // }

        //signerPromise
        return signer.signTypedData(typedDataDomain, types, message).then(resolve).catch(reject);
    });
}

export async function signStruct(
    primaryType: string,
    message: Record<string, any>,
    domain: TypedDataDomain,
    wallet: AbstractSigner,
): Promise<Record<string, any>> {
    return eth_signTypedData(primaryType, message, domain, wallet).then((sign) => {
        message.sign = sign;
        return message;
    });
}

export function hashStruct(
    primaryType: string,
    message: Record<string, any>,
    domain: TypedDataDomain,
): string {
    const typedDataDomain: TypedDataDomain = {
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
