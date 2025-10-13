// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Signature } from 'ethers';
import hre, { ethers } from 'hardhat';
import { LibDiamond__factory } from '../typechain';

export function compactSignature(signature: string): string {
    return Signature.from(signature).compactSerialized;
}

export function bigintToAddress(bigint: bigint) {
    return ethers.getAddress(ethers.toBeHex(bigint, 20));
}

export function minBigInt(a: bigint, b: bigint) {
    return a < b ? a : b;
}

export function maxBigInt(a: bigint, b: bigint) {
    return a > b ? a : b;
}

/**
 * Deploys the `LibDiamond` library if running coverage task and returns
 * the linking configuration. Returns an empty config if not running coverage
 * task.
 * This fixes an issue with the coverage task that requires the library to be
 * deployed and linked to contracts where it is used.
 * @param deployer Signer to deploy the library.
 * @returns The library configuration or an empty object.
 */
export async function getLibDiamondConfigOrEmpty(deployer: SignerWithAddress): Promise<any> {
    // No need to deploy the library if not running coverage task.
    if (!(hre as any).__SOLIDITY_COVERAGE_RUNNING) {
        return {};
    }
    const libDiamondAddress = await new LibDiamond__factory()
        .connect(deployer)
        .deploy()
        .then((contract) => contract.waitForDeployment())
        .then((contract) => contract.getAddress());
    return {
        ['@mudgen/diamond-1/contracts/libraries/LibDiamond.sol:LibDiamond']: libDiamondAddress,
    };
}
