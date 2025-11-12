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

        let signerPromise;

        if (wallet.privateKey) {
            const walletInstance = new ethers.Wallet(wallet.privateKey, hre.ethers.provider);
            signerPromise = Promise.resolve(walletInstance);
        } else {
            if (wallet.address) {
                signerPromise = hre.ethers.getSigner(wallet.address);
            } else {
                reject(new Error('Wallet address is undefined'));
                return;
            }
        }

        signerPromise
            .then((signer) => signer.signTypedData(typedDataDomain, types, message))
            .then(resolve)
            .catch(reject);
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

    return TypedDataEncoder.hash(typedDataDomain, types, message);
}

/**
 * Encode orders with matchOrders selector for receiveApproval callback.
 *
 * The encoded data includes the function selector as the first 4 bytes, which allows
 * the generalized receiveApproval implementation to:
 * 1. Extract the selector to identify the operation (matchOrders in this case)
 * 2. Call the appropriate validator (_validateMatchOrders for permission checks)
 *
 * @param appOrder App order struct
 * @param datasetOrder Dataset order struct
 * @param workerpoolOrder Workerpool order struct
 * @param requestOrder Request order struct
 * @returns ABI-encoded calldata with matchOrders selector + encoded order structs
 */
export function encodeOrders(
    appOrder: Record<string, any>,
    datasetOrder: Record<string, any>,
    workerpoolOrder: Record<string, any>,
    requestOrder: Record<string, any>,
): string {
    // These types match the typechain-generated structs in IexecLibOrders_v5
    // AppOrderStruct, DatasetOrderStruct, WorkerpoolOrderStruct, RequestOrderStruct
    // By using named tuple components, ethers can encode objects with named properties
    const appOrderType =
        'tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign)';
    const datasetOrderType =
        'tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign)';
    const workerpoolOrderType =
        'tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign)';
    const requestOrderType =
        'tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign)';

    // Encode the function parameters (without selector)
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        [appOrderType, datasetOrderType, workerpoolOrderType, requestOrderType],
        [appOrder, datasetOrder, workerpoolOrder, requestOrder],
    );

    // Get the function selector for matchOrders using ethers Interface
    // This is the correct way to get the selector for a function with struct parameters
    const iface = new ethers.Interface([
        `function matchOrders(${appOrderType} apporder, ${datasetOrderType} datasetorder, ${workerpoolOrderType} workerpoolorder, ${requestOrderType} requestorder)`,
    ]);
    const matchOrdersSelector = iface.getFunction('matchOrders')!.selector;

    // Combine selector + encoded parameters
    return matchOrdersSelector + encodedParams.slice(2);
}
