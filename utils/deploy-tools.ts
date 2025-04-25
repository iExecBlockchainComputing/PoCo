// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractFactory } from 'ethers';
import { deployments } from 'hardhat';

/**
 * Deploy a contract and save its deployment.
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
    const args = constructorArgs ?? [];
    const contractInstance = await contractFactory
        .connect(deployer)
        .deploy(...args)
        .then((x) => x.waitForDeployment());
    const contractName = getBaseNameFromContractFactory(contractFactory);
    const contractAddress = await contractInstance.getAddress();
    await deployments.save(contractName, {
        abi: (contractFactory as any).constructor.abi,
        address: contractAddress,
        args: args,
        bytecode: contractFactory.bytecode,
        deployedBytecode: (await contractFactory.getDeployTransaction(...args)).data,
    });
    if (!opts || (opts && !opts.quiet)) {
        console.log(`${contractName}: ${contractAddress}`);
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
