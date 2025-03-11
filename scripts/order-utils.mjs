// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'ethers';

// Constants
export const NULL = {
    ADDRESS: "0x0000000000000000000000000000000000000000",
    BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000",
    SIGNATURE: "0x"
};

// Order operations enum
export const OrderOperationEnum = {
    SIGN: 0,
    CLOSE: 1
};

// ----------------------------------------
// Order utility functions
// ----------------------------------------

// Create empty orders
export function createEmptyAppOrder() {
    return {
        app: NULL.ADDRESS,
        appprice: BigInt(0),
        volume: 1,
        tag: NULL.BYTES32,
        datasetrestrict: NULL.BYTES32,
        workerpoolrestrict: NULL.BYTES32,
        requesterrestrict: NULL.BYTES32,
        salt: NULL.BYTES32,
        sign: NULL.SIGNATURE,
    };
}

export function createEmptyDatasetOrder() {
    return {
        dataset: NULL.ADDRESS,
        datasetprice: BigInt(0),
        volume: 1,
        tag: NULL.BYTES32,
        apprestrict: NULL.BYTES32,
        workerpoolrestrict: NULL.BYTES32,
        requesterrestrict: NULL.BYTES32,
        salt: NULL.BYTES32,
        sign: NULL.SIGNATURE,
    };
}

export function createEmptyWorkerpoolOrder() {
    return {
        workerpool: NULL.ADDRESS,
        workerpoolprice: BigInt(0),
        volume: 1,
        tag: NULL.BYTES32,
        category: 0,
        trust: BigInt(0),
        apprestrict: NULL.BYTES32,
        datasetrestrict: NULL.BYTES32,
        requesterrestrict: NULL.BYTES32,
        salt: NULL.BYTES32,
        sign: NULL.SIGNATURE,
    };
}

export function createEmptyRequestOrder() {
    return {
        app: NULL.ADDRESS,
        appmaxprice: 0,
        dataset: NULL.ADDRESS,
        datasetmaxprice: 0,
        workerpool: NULL.ADDRESS,
        workerpoolmaxprice: 0,
        volume: 1,
        tag: NULL.BYTES32,
        category: 0,
        trust: BigInt(0),
        requester: NULL.ADDRESS,
        beneficiary: NULL.ADDRESS,
        callback: NULL.ADDRESS,
        params: '',
        salt: NULL.BYTES32,
        sign: NULL.SIGNATURE,
    };
}

// Create order operation
export function createOrderOperation(order, operation) {
    return { 
        order, 
        operation: Number(operation), 
        sign: NULL.SIGNATURE 
    };
}

// Get the type of an order
export function getOrderType(order) {
    if ('requester' in order) return 'RequestOrder';
    if ('app' in order && 'appprice' in order) return 'AppOrder';
    if ('dataset' in order && 'datasetprice' in order) return 'DatasetOrder';
    if ('workerpool' in order && 'workerpoolprice' in order) return 'WorkerpoolOrder';
    return '';
}

// Build EIP-712 types for an order
export function buildTypes(primaryType) {
    const types = {
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
            { name: 'datasetrestrict', type: 'bytes32' },
            { name: 'workerpoolrestrict', type: 'bytes32' },
            { name: 'requesterrestrict', type: 'bytes32' },
            { name: 'salt', type: 'bytes32' }
        ],
        DatasetOrder: [
            { name: 'dataset', type: 'address' },
            { name: 'datasetprice', type: 'uint256' },
            { name: 'volume', type: 'uint256' },
            { name: 'tag', type: 'bytes32' },
            { name: 'apprestrict', type: 'bytes32' },
            { name: 'workerpoolrestrict', type: 'bytes32' },
            { name: 'requesterrestrict', type: 'bytes32' },
            { name: 'salt', type: 'bytes32' }
        ],
        WorkerpoolOrder: [
            { name: 'workerpool', type: 'address' },
            { name: 'workerpoolprice', type: 'uint256' },
            { name: 'volume', type: 'uint256' },
            { name: 'category', type: 'uint256' },
            { name: 'trust', type: 'uint256' },
            { name: 'tag', type: 'bytes32' },
            { name: 'apprestrict', type: 'bytes32' },
            { name: 'datasetrestrict', type: 'bytes32' },
            { name: 'requesterrestrict', type: 'bytes32' },
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
        ]
    };
    return types;
}

// Get EIP-712 typed data for an order
export function getEip712TypedDataOrder(domain, order) {
    const orderType = getOrderType(order);
    const types = buildTypes(orderType);
    
    return {
        domain: {
            name: domain.name,
            version: domain.version,
            chainId: Number(domain.chainId),
            verifyingContract: domain.verifyingContract,
        },
        types,
        primaryType: orderType,
        message: order
    };
}

// Hash an order using EIP-712
export async function hashOrder(domain, order) {
    const orderType = getOrderType(order);
    const types = buildTypes(orderType);
    return ethers.TypedDataEncoder.hash(domain, { [orderType]: types[orderType] }, order);
}

// Sign an order using a signer
export async function signOrder(domain, order, signer) {
    const orderType = getOrderType(order);
    const types = buildTypes(orderType);
    
    const signature = await signer.signTypedData(
        domain,
        { [orderType]: types[orderType] },
        order
    );
    
    order.sign = signature;
    return signature;
}

// Sign message
export async function signMessage(signer, message) {
    return signer.signMessage(message);
}

// Deal and task ID generation
export function getDealId(domain, requestOrder, taskIndex) {
    const requestHash = hashOrder(domain, requestOrder);
    const dealIdRaw = ethers.solidityPackedKeccak256(
        ['bytes32', 'uint256'],
        [requestHash, taskIndex]
    );
    return dealIdRaw;
}

export function getTaskId(dealId, taskIdx) {
    return ethers.solidityPackedKeccak256(
        ['bytes32', 'uint256'],
        [dealId, taskIdx]
    );
}

// Contribution authorization message
export function buildContributionAuthorizationMessage(workerAddress, taskId, enclaveChallenge) {
    return `iExec contribution authorization
Worker: ${workerAddress}
Task: ${taskId}
Enclave challenge: ${enclaveChallenge}`;
}

// Build result and digest
export function buildUtf8ResultAndDigest(string) {
    const results = string;
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes(results));
    const resultDigest = ethers.keccak256(
        ethers.solidityPacked(['bytes32'], [resultHash])
    );
    return { results, resultDigest };
}
