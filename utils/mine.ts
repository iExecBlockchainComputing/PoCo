// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { isLocalFork } from './config';

/**
 * This function is used to mine one block if we are on a local fork
 */

export async function mineBlockIfOnLocalFork() {
    if (isLocalFork()) {
        /**
         * This fixes following issue when deploying to a local Bellecour fork:
         * `ProviderError: No known hardfork for execution on historical block [...] in chain with id 134.`
         * See: https://github.com/NomicFoundation/hardhat/issues/5511#issuecomment-2288072104
         */
        await mine();
    }
}
