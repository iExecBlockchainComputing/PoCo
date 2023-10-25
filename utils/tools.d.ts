// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractReceipt, Event } from '@ethersproject/contracts';

export function extractEventsFromReceipt(
    txReceipt: ContractReceipt,
    address: string,
    name: string,
): Event[];
