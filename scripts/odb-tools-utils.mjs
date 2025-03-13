// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataEncoder, verifyTypedData } from 'ethers';
import { hashOrder, getTypeOf,signOrder } from './order-utils.mjs';

const TYPES =  {
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


// Update your debugWorkerpoolSignature function
export async function debugWorkerpoolSignature(domain, order, expectedSigner) {
    console.log('\n===== WORKERPOOL ORDER SIGNATURE DEBUG =====');
    
    console.log('\n-- Order Details --');
    console.log('Workerpool:', order.workerpool);
    console.log('Volume:', typeof order.volume === 'bigint' ? order.volume.toString() : order.volume);
    console.log('Salt:', order.salt);
    console.log('Sign:', order.sign);
    
    const orderHash = await hashOrder(domain, order);
    console.log('\n-- Order Hash --');
    console.log(`Order Hash: ${orderHash}`);
    
    const orderType = getTypeOf(order);
    const types = TYPES[orderType];
    console.log('\n-- Manual Hash Calculation --');
    
    // Clone and prepare order for display, handling BigInt values
    const orderForDisplay = Object.entries(order).reduce((acc, [key, value]) => {
        if (key !== 'sign') {
            acc[key] = typeof value === 'bigint' ? value.toString() : value;
        }
        return acc;
    }, {});
    console.log('Order for hashing:', JSON.stringify(orderForDisplay, null, 2));
    
    // Prepare order for hashing
    const orderForHashing = {...order};
    delete orderForHashing.sign;
    
    try {
        const manualHash = TypedDataEncoder.hash(
            {
                name: domain.name,
                version: domain.version,
                chainId: domain.chainId,
                verifyingContract: domain.verifyingContract
            },
            { [orderType]: types },
            orderForHashing
        );
        
        console.log(`Manual Hash: ${manualHash}`);
        console.log(`Hashes match: ${orderHash === manualHash ? 'Yes' : 'No'}`);
        await signOrder(domain, orderForHashing, expectedSigner);
        console.log(`Signature match: ${order.sign === orderForHashing.sign ? 'Yes' : 'No'}`);

    } catch (error) {
        console.error('Error computing manual hash:', error.message);
    }
    
    // 5. Verify signature
    console.log('\n-- Signature Verification --');
    
    // Use the new verification function
    const orderForVerification = {...order};
    delete orderForVerification.sign; // Remove sign field for verification
    
    const isValid = verifyTypedDataSignature(
        domain,
        orderType,
        orderForVerification,
        order.sign,
        expectedSigner.address
    );
    
    console.log(`Signature Valid for ${expectedSigner.address}: ${isValid ? 'YES' : 'NO'}`);
    console.log('\n-- Signature Format --');
    console.log(`Signature Length: ${order.sign.length} characters (${(order.sign.length - 2) / 2} bytes)`);
    
    if (order.sign.length === 132) { // 0x + 64 bytes
        console.log('Format: 64-byte signature (r,s without v)');
    } else if (order.sign.length === 134) { // 0x + 65 bytes
        console.log('Format: 65-byte signature (r,s,v)');
        console.log('v value:', parseInt(order.sign.slice(-2), 16));
    } else {
        console.log('Format: Unexpected signature length');
    }
    
    try {
        // Try to recover the signer directly
        const typedDataDomain = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract
        };
        
        const recoveredAddress = verifyTypedData(
            typedDataDomain, 
            { [orderType]: types }, 
            orderForVerification, 
            order.sign
        );
        
        console.log(`\nDirectly recovered signer: ${recoveredAddress}`);
        console.log(`Expected signer: ${expectedSigner.address}`);
        console.log(`Match with expected: ${recoveredAddress.toLowerCase() === expectedSigner.address.toLowerCase() ? 'YES' : 'NO'}`);
    } catch (error) {
        console.error('Error recovering signer:', error.message);
    }
    
    console.log('\n=====  END DEBUG  =====\n');
}

export function verifyTypedDataSignature(domain, primaryType, value, signature, expectedSigner) {
    try {
        // Create the domain object in expected format
        const typedDataDomain = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract
        };
        
        // Get types for the primary type
        const types = buildTypes(primaryType);
        
        // Verify the signature
        const recoveredAddress = verifyTypedData(
            typedDataDomain, 
            types, 
            value, 
            signature
        );
        
        // Compare addresses in a case-insensitive manner
        return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
        console.error('Signature verification error:', error.message);
        return false;
    }
}

export async function getDomain(provider, iexecProxyAddress, verbose = false) {
    try {
      // Get chain ID from the connected provider
      const chainId = Number((await provider.getNetwork()).chainId);
      
      // Construct the domain object according to EIP-712
      const domain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId,
        verifyingContract: iexecProxyAddress
      };
      
      if (verbose) {
        console.log('Domain:', domain);
      }
      
      return domain;
    } catch (error) {
      console.error('Error creating domain object:', error);
      throw new Error(`Failed to create domain object: ${error.message}`);
    }
  }