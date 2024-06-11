// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { MockContract, smock } from '@defi-wonderland/smock';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';

export async function createMock<CF extends ContractFactory, C extends Contract>(
    contractName: string,
    factoryOptions?: FactoryOptions,
    ...args: Parameters<CF['deploy']>
): Promise<MockContract<C>> {
    return (await smock
        .mock<CF>(contractName, factoryOptions)
        .then((contract) => contract.deploy(...args))
        .then((instance) => instance.deployed())) as MockContract<C>;
}
