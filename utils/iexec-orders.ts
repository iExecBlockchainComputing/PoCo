// utils/iexec-orders.ts
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { TypedDataDomain, TypedDataEncoder, ethers } from 'ethers';
import type { IexecLibOrders_v5 } from '../typechain/contracts/libs/IexecLibOrders_v5';

// Re-export the types from TypeChain
export type AppOrder = IexecLibOrders_v5.AppOrderStruct;
export type DatasetOrder = IexecLibOrders_v5.DatasetOrderStruct;
export type WorkerpoolOrder = IexecLibOrders_v5.WorkerpoolOrderStruct;
export type RequestOrder = IexecLibOrders_v5.RequestOrderStruct;
export type EIP712DomainStruct = IexecLibOrders_v5.EIP712DomainStruct;

// EIP-712 Type Definitions
export const EIP712_TYPES = {
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
        { name: 'salt', type: 'bytes32' },
    ],
    DatasetOrder: [
        { name: 'dataset', type: 'address' },
        { name: 'datasetprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'apprestrict', type: 'address' },
        { name: 'workerpoolrestrict', type: 'address' },
        { name: 'requesterrestrict', type: 'address' },
        { name: 'salt', type: 'bytes32' },
    ],
    WorkerpoolOrder: [
        { name: 'workerpool', type: 'address' },
        { name: 'workerpoolprice', type: 'uint256' },
        { name: 'volume', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'category', type: 'uint256' },
        { name: 'trust', type: 'uint256' },
        { name: 'apprestrict', type: 'address' },
        { name: 'datasetrestrict', type: 'address' },
        { name: 'requesterrestrict', type: 'address' },
        { name: 'salt', type: 'bytes32' },
    ],
    RequestOrder: [
        { name: 'app', type: 'address' },
        { name: 'appmaxprice', type: 'uint256' },
        { name: 'dataset', type: 'address' },
        { name: 'datasetmaxprice', type: 'uint256' },
        { name: 'workerpool', type: 'address' },
        { name: 'workerpoolmaxprice', type: 'uint256' },
        { name: 'requester', type: 'address' },
        { name: 'volume', type: 'uint256' },
        { name: 'tag', type: 'bytes32' },
        { name: 'category', type: 'uint256' },
        { name: 'trust', type: 'uint256' },
        { name: 'beneficiary', type: 'address' },
        { name: 'callback', type: 'address' },
        { name: 'params', type: 'string' },
        { name: 'salt', type: 'bytes32' },
    ],
};

/**
 * Convert EIP712DomainStruct (from TypeChain) to TypedDataDomain (for ethers)
 */
export async function toTypedDataDomain(
    domainStruct: EIP712DomainStruct,
): Promise<TypedDataDomain> {
    return {
        name: domainStruct.name,
        version: domainStruct.version,
        chainId: BigInt(domainStruct.chainId.toString()),
        verifyingContract: await ethers.resolveAddress(domainStruct.verifyingContract),
    };
}

/**
 * Remove the 'sign' field from an order before signing
 */
function removeSignField<T extends object>(order: T): Omit<T, 'sign'> {
    // Remove the 'sign' property if it exists, otherwise return the object as is
    const { sign, ...orderWithoutSign } = order as any;
    return orderWithoutSign as Omit<T, 'sign'>;
}

/**
 * Convert order values to plain objects (resolve all AddressLike, BigNumberish, etc.)
 */
async function normalizeOrder<T extends Record<string, any>>(
    order: T,
): Promise<Record<string, any>> {
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(order)) {
        if (key === 'sign') continue; // Skip sign field

        // Handle different types
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            normalized[key] = value;
        } else if (typeof value === 'bigint') {
            normalized[key] = value;
        } else if (value && typeof value === 'object' && 'toString' in value) {
            // Handle BigNumberish
            normalized[key] = BigInt(value.toString());
        } else if (ethers.isAddressable(value)) {
            // Handle AddressLike
            normalized[key] = await ethers.resolveAddress(value);
        } else {
            normalized[key] = value;
        }
    }

    return normalized;
}

/**
 * Sign an AppOrder using EIP-712
 */
export async function signAppOrder(
    domain: EIP712DomainStruct,
    order: Omit<AppOrder, 'sign'>,
    signer: SignerWithAddress,
): Promise<AppOrder> {
    // Convert domain and order to ethers-compatible format
    const typedDataDomain = await toTypedDataDomain(domain);
    const normalizedOrder = await normalizeOrder(removeSignField(order));

    const signature = await signer.signTypedData(
        typedDataDomain,
        { AppOrder: EIP712_TYPES.AppOrder },
        normalizedOrder,
    );

    return {
        ...order,
        sign: signature,
    } as AppOrder;
}

/**
 * Sign a DatasetOrder using EIP-712
 */
export async function signDatasetOrder(
    domain: EIP712DomainStruct,
    order: Omit<DatasetOrder, 'sign'>,
    signer: SignerWithAddress,
): Promise<DatasetOrder> {
    const typedDataDomain = await toTypedDataDomain(domain);
    const normalizedOrder = await normalizeOrder(removeSignField(order));

    const signature = await signer.signTypedData(
        typedDataDomain,
        { DatasetOrder: EIP712_TYPES.DatasetOrder },
        normalizedOrder,
    );

    return {
        ...order,
        sign: signature,
    } as DatasetOrder;
}

/**
 * Sign a WorkerpoolOrder using EIP-712
 */
export async function signWorkerpoolOrder(
    domain: EIP712DomainStruct,
    order: Omit<WorkerpoolOrder, 'sign'>,
    signer: SignerWithAddress,
): Promise<WorkerpoolOrder> {
    const typedDataDomain = await toTypedDataDomain(domain);
    const normalizedOrder = await normalizeOrder(removeSignField(order));

    const signature = await signer.signTypedData(
        typedDataDomain,
        { WorkerpoolOrder: EIP712_TYPES.WorkerpoolOrder },
        normalizedOrder,
    );

    return {
        ...order,
        sign: signature,
    } as WorkerpoolOrder;
}

/**
 * Sign a RequestOrder using EIP-712
 */
export async function signRequestOrder(
    domain: EIP712DomainStruct,
    order: Omit<RequestOrder, 'sign'>,
    signer: SignerWithAddress,
): Promise<RequestOrder> {
    const typedDataDomain = await toTypedDataDomain(domain);
    const normalizedOrder = await normalizeOrder(removeSignField(order));

    const signature = await signer.signTypedData(
        typedDataDomain,
        { RequestOrder: EIP712_TYPES.RequestOrder },
        normalizedOrder,
    );

    return {
        ...order,
        sign: signature,
    } as RequestOrder;
}

/**
 * Compute the struct hash of an order (for debugging)
 */
export async function hashOrder(
    orderType: 'AppOrder' | 'DatasetOrder' | 'WorkerpoolOrder' | 'RequestOrder',
    order: any,
): Promise<string> {
    const normalizedOrder = await normalizeOrder(removeSignField(order));
    const types = { [orderType]: EIP712_TYPES[orderType] };
    return TypedDataEncoder.hashStruct(orderType, types, normalizedOrder);
}

/**
 * Compute the full EIP-712 typed data hash (for debugging)
 */
export async function hashTypedData(
    domain: EIP712DomainStruct,
    orderType: 'AppOrder' | 'DatasetOrder' | 'WorkerpoolOrder' | 'RequestOrder',
    order: any,
): Promise<string> {
    const typedDataDomain = await toTypedDataDomain(domain);
    const normalizedOrder = await normalizeOrder(removeSignField(order));
    const types = { [orderType]: EIP712_TYPES[orderType] };
    return TypedDataEncoder.hash(typedDataDomain, types, normalizedOrder);
}

/**
 * Verify a signature locally (for debugging)
 */
export async function verifySignature(
    domain: EIP712DomainStruct,
    orderType: 'AppOrder' | 'DatasetOrder' | 'WorkerpoolOrder' | 'RequestOrder',
    order: any,
    expectedSigner: string,
): Promise<boolean> {
    if (!order.sign) {
        throw new Error('Order has no signature');
    }

    const typedDataHash = await hashTypedData(domain, orderType, order);
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(typedDataHash), order.sign);

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
}
