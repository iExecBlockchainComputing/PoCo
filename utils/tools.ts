// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { Signature, toBeHex, type BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

export function compactSignature(signature: string): string {
    return Signature.from(signature).compactSerialized;
}

export function BN2Address(bignumber: BigNumberish) {
    return ethers.getAddress(toBeHex(bignumber));
}
