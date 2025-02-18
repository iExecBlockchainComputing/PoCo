// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { Signature } from 'ethers';
import { ethers } from 'hardhat';

export function compactSignature(signature: string): string {
    return Signature.from(signature).compactSerialized;
}

export function bigintToAddress(bigint: bigint) {
    return ethers.getAddress(ethers.toBeHex(bigint));
}
