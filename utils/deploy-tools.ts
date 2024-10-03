// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments } from 'hardhat';

/**
 * Deploy a contract.
 * @param contractFactory The contract to deploy
 * @param deployer The signer to deploy the contract
 * @param constructorArgs Arguments passed to the contract constructor at deployment
 * @param opts Additional options
 * @returns an instance of the deployed contract
 */
export async function deploy(
    contractFactory: ContractFactory,
    deployer: SignerWithAddress,
    constructorArgs?: any[],
    opts?: { quiet: boolean },
) {
    const contractInstance = await contractFactory
        .connect(deployer)
        .deploy(...(constructorArgs ?? []))
        .then((x) => x.deployed());
    const contractName = getBaseNameFromContractFactory(contractFactory);
    await deployments.save(contractName, {
        abi: (contractFactory as any).constructor.abi,
        address: contractInstance.address,
    });
    if (!opts || (opts && !opts.quiet)) {
        console.log(`${contractName}: ${contractInstance.address}`);
    }
    return contractInstance;
}

/**
 * Extract base contract name from contract factory name.
 * Inputting `MyBoxContract__factory` returns `MyBoxContract`.
 */
export function getBaseNameFromContractFactory(contractFactory: any) {
    const name = contractFactory.constructor.name;
    return name.replace('__factory', '');
}
