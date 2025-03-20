// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {hashStruct,signStruct, buildTypes} from './odb-tools-utils.mjs';
import { ethers } from 'ethers';

// Constants
export const NULL = {
    ADDRESS: "0x0000000000000000000000000000000000000000",
    BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000",
    SIGNATURE: "0x"
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
        datasetrestrict: NULL.ADDRESS,
        workerpoolrestrict: NULL.ADDRESS,
        requesterrestrict: NULL.ADDRESS,
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
        category: 2,
        trust: BigInt(0),
        requester: NULL.ADDRESS,
        beneficiary: NULL.ADDRESS,
        callback: NULL.ADDRESS,
        params: '',
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
        apprestrict: NULL.ADDRESS,
        workerpoolrestrict: NULL.ADDRESS,
        requesterrestrict: NULL.ADDRESS,
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
        category: 2,
        trust: BigInt(0),
        apprestrict: NULL.ADDRESS,
        datasetrestrict: NULL.ADDRESS,
        requesterrestrict: NULL.ADDRESS,
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
export function getTypeOf(order) {
    if ('requester' in order) return 'RequestOrder';
    if ('app' in order && 'appprice' in order) return 'AppOrder';
    if ('dataset' in order && 'datasetprice' in order) return 'DatasetOrder';
    if ('workerpool' in order && 'workerpoolprice' in order) return 'WorkerpoolOrder';
    return '';
}

export function hashOrder(domain, order) {
    // console.log('domain', domain);
    // console.log('hashOrder', order);
    // console.log('getTypeOf(order)', getTypeOf(order));
    return hashStruct(getTypeOf(order), order, domain)
}

// Sign an order using a signer
export async function signOrder(domain, order, signer) {
    return signStruct(getTypeOf(order), order, domain, signer)
}

// Get EIP-712 typed data for an order
export function getEip712TypedDataOrder(domain, order) {
    const primaryType = getTypeOf(order);
    return {
        domain: {
            name: domain.name,
            version: domain.version,
            chainId: Number(domain.chainId),
            verifyingContract: domain.verifyingContract,
        },
        types: buildTypes(primaryType),
        message: order,
        primaryType: primaryType,
    };
}

export async function signOrderWithAlchemySmartAccountSigner(domain, order, smartAccountClient) {
    const eip712Order = getEip712TypedDataOrder(domain, order);
    
    // Remove sign from the order before signing
    const messageToSign = { ...eip712Order.message };
    delete messageToSign.sign;
    
    try {
        // Pass typedData as a property not as direct parameters
        const signature = await smartAccountClient.signTypedData({
            typedData: {
                domain: eip712Order.domain,
                types: eip712Order.types,
                primaryType: eip712Order.primaryType,
                message: messageToSign
            }
        });
        
        console.log('Signature received:', signature);
        order.sign = signature;
    } catch (error) {
        console.error('Error signing with Smart Account:', error);
        throw error;
    }
}

export async function signOrderWithPimlicoSmartAccountSigner(domain, order, smartAccountClient) {
    const eip712Order = getEip712TypedDataOrder(domain, order);
    
    // Remove sign from the order before signing
    const messageToSign = { ...eip712Order.message };
    delete messageToSign.sign;
    
    try {
        // Pass typedData as a property not as direct parameters
        const signature = await smartAccountClient.signTypedData({
                domain: eip712Order.domain,
                types: eip712Order.types,
                primaryType: eip712Order.primaryType,
                message: messageToSign
        });
        
        console.log('Signature received:', signature);
        order.sign = signature;
    } catch (error) {
        console.error('Error signing with Smart Account:', error);
        throw error;
    }
}

// Sign message
export async function signMessage(signer, message) {
    return signer.signMessage(ethers.getBytes(message));
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
    return ethers.solidityPackedKeccak256(['bytes32', 'uint256'], [dealId, taskIdx]);
}


export async function buildAndSignContributionAuthorizationMessage(worker,taskId,enclave,authorizer,
) {
    const schedulerMessage = buildContributionAuthorizationMessage(worker, taskId, enclave);
    return await signMessage(authorizer, schedulerMessage);
}
// Contribution authorization message
export function buildContributionAuthorizationMessage(workerAddress, taskId, enclaveAddress) {
    return ethers.solidityPackedKeccak256(
        ['address', 'bytes32', 'address'],
        [workerAddress, taskId, enclaveAddress],
    );
}

// Build result and digest
export function buildUtf8ResultAndDigest(resultPayload) {
    const results = ethers.toUtf8Bytes(resultPayload);
    const resultDigest = ethers.keccak256(results);
    return { results, resultDigest };
}