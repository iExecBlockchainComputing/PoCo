// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { assert } from 'chai';
import type { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { ContractReceipt, Event } from '@ethersproject/contracts';

export function extractEventsFromReceipt(
    txReceipt: ContractReceipt,
    address: string,
    name: string,
): Event[] {
    const receiptEvents = txReceipt?.events || [];
    const events = receiptEvents.filter((event) => {
        return event.address == address && event.event == name;
    });
    assert.isNotEmpty(events, `Fail to extract '${name}' event`);
    return events;
}

export function compactSignature(signature: string): string {
    const split = ethers.utils.splitSignature(signature);
    let vs = ethers.utils.arrayify(split.s);
    if (split.v == 1 || split.v == 28) {
        vs[0] |= 0x80;
    }
    return ethers.utils.hexlify(ethers.utils.concat([split.r, vs]));
}

export function BN2Address(bignumber: BigNumber) {
    const lowercaseAddress = ethers.utils.hexZeroPad(bignumber.toHexString(), 20);
    return ethers.utils.getAddress(lowercaseAddress);
}
