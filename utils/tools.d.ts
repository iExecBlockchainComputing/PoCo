// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH

import { ContractReceipt, Event } from '@ethersproject/contracts';

export function extractEventsFromReceipt(
    txReceipt: ContractReceipt,
    address: string,
    name: string,
): Event[];
