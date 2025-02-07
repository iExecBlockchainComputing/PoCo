// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const ethers = require('ethers');

const TYPES = {
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

function buildTypes(primaryType) {
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

function eth_signTypedData(primaryType, message, domain, wallet) {
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
            signerPromise = hre.ethers.getSigner(wallet.address);
        }

        signerPromise
            .then((signer) => signer._signTypedData(typedDataDomain, types, message))
            .then(resolve)
            .catch(reject);
    });
}

function signStruct(primaryType, message, domain, wallet) {
    return eth_signTypedData(primaryType, message, domain, wallet).then((sign) => {
        message.sign = sign;
        return message;
    });
}

function hashStruct(primaryType, message, domain) {
    let typedDataDomain = {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract,
    };
    const types = {
        [primaryType]: TYPES[primaryType],
    };

    return ethers.utils._TypedDataEncoder.hash(typedDataDomain, types, message);
}

/*****************************************************************************
 *                                  MODULE                                   *
 *****************************************************************************/
module.exports = {
    utils: {
        signStruct,
        hashStruct,
    },
};
