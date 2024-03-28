// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/**
 * Extract base contract name from contract factory name.
 * Inputting `MyBoxContract__factory` returns `MyBoxContract`.
 */
export function getBaseNameFromContractFactory(contractFactory: any) {
    const name = contractFactory.constructor.name;
    return name.replace('__factory', '');
}
