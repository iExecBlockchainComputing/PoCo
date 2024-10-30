// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { getFunctionSignatures } from '../migrations/utils/getFunctionSignatures';
import { ERC1538Update } from '../typechain';
import { getBaseNameFromContractFactory } from '../utils/deploy-tools';

/**
 * Link a contract to an ERC1538 proxy.
 * @param proxy contract to ERC1538 proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
export async function linkContractToProxy(
    proxy: ERC1538Update,
    contractAddress: string,
    contractFactory: any,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    await proxy
        .updateContract(
            contractAddress,
            // TODO: Use contractFactory.interface.functions when moving to ethers@v6
            // https://github.com/ethers-io/ethers.js/issues/1069
            getFunctionSignatures(contractFactory.constructor.abi),
            'Linking ' + contractName,
        )
        .then((tx) => tx.wait())
        .catch(() => {
            throw new Error(`Failed to link ${contractName}`);
        });
}
