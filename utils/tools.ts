// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { toBeHex, type BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

export function compactSignature(signature: string): string {
    const split = ethers.Signature.from(signature);
    let vs = ethers.getBytes(split.s);
    if (split.v == 27 || split.v == 28) {
        vs[0] |= 0x80;
    }
    return ethers.hexlify(ethers.concat([split.r, vs]));
}

export function BN2Address(bignumber: BigNumberish) {
    return ethers.getAddress(toBeHex(bignumber));
}
