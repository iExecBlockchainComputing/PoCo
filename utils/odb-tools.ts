// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataDomain, TypedDataEncoder, TypedDataField, ethers } from 'ethers';
import hre from 'hardhat';

interface WalletInfo {
    privateKey?: string;
    address?: string;
}

interface Types {
    [key: string]: Array<TypedDataField>;
}

export const TYPES: Types = {
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

function buildTypes(primaryType: string): Types {
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

/**
 * Remove the 'sign' field from message before signing.
 * This is crucial because EIP-712 signature should not include the signature field itself.
 */
export function removeSignField(message: Record<string, any>): Record<string, any> {
    const { sign, ...messageWithoutSign } = message;
    return messageWithoutSign;
}

/**
 * For nested order operations, we need to remove sign from the nested order
 */
function prepareMessageForSigning(
    primaryType: string,
    message: Record<string, any>,
): Record<string, any> {
    // If it's an OrderOperation type, we need to handle the nested order
    if (primaryType.endsWith('Operation')) {
        const messageWithoutSign = removeSignField(message);
        if (messageWithoutSign.order) {
            // Remove sign from nested order as well
            messageWithoutSign.order = removeSignField(messageWithoutSign.order);
        }
        return messageWithoutSign;
    }

    // For regular orders, just remove the sign field
    return removeSignField(message);
}

async function eth_signTypedData(
    primaryType: string,
    message: Record<string, any>,
    domain: TypedDataDomain,
    wallet: WalletInfo,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const typedDataDomain = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract,
        };
        const types = buildTypes(primaryType);

        // CRITICAL FIX: Remove 'sign' field before signing
        const messageToSign = prepareMessageForSigning(primaryType, message);

        // Helper function to stringify with BigInt support
        const stringifyWithBigInt = (obj: any) =>
            JSON.stringify(
                obj,
                (key, value) => (typeof value === 'bigint' ? value.toString() : value),
                2,
            );

        // Debug logging with BigInt support
        console.log(`\n=== Signing ${primaryType} ===`);
        console.log('Domain:', stringifyWithBigInt(typedDataDomain));
        console.log('Message to sign:', stringifyWithBigInt(messageToSign));

        let signerPromise;

        if (wallet.privateKey) {
            const walletInstance = new ethers.Wallet(wallet.privateKey, hre.ethers.provider);
            console.log('Signer address (from privateKey):', walletInstance.address);
            signerPromise = Promise.resolve(walletInstance);
        } else {
            if (wallet.address) {
                console.log('Signer address:', wallet.address);
                signerPromise = hre.ethers.getSigner(wallet.address);
            } else {
                reject(new Error('Wallet address is undefined'));
                return;
            }
        }

        signerPromise
            .then((signer) => {
                console.log('About to sign with:', signer.address);
                return signer.signTypedData(typedDataDomain, types, messageToSign);
            })
            .then((signature) => {
                console.log('Signature produced:', signature);
                resolve(signature);
            })
            .catch((error) => {
                console.error('Signing error:', error);
                reject(error);
            });
    });
}

export async function signStruct(
    primaryType: string,
    message: Record<string, any>,
    domain: TypedDataDomain,
    wallet: WalletInfo,
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

    // CRITICAL FIX: Remove 'sign' field before hashing
    const messageToHash = removeSignField(message);

    return TypedDataEncoder.hash(typedDataDomain, types, messageToHash);
}

export function hashTypedData(domain: TypedDataDomain, typeName: string, message: any): string {
    const { TypedDataEncoder } = require('ethers');

    // Get the struct hash
    const structHash = TypedDataEncoder.hashStruct(
        typeName,
        { [typeName]: TYPES[typeName] },
        message,
    );

    // Compute domain separator
    const domainSeparator = TypedDataEncoder.hashDomain(domain);

    // Compute the full EIP-712 digest: keccak256("\x19\x01" || domainSeparator || structHash)
    const digest = ethers.keccak256(ethers.concat(['0x1901', domainSeparator, structHash]));

    return digest;
}
