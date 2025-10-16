// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import hre, { deployments } from 'hardhat';
import path from 'path';

export interface ContractToVerify {
    name: string;
    address: string;
    constructorArguments?: any[];
}

/**
 * Verifies contracts on block explorer (e.g., Etherscan, Arbiscan).
 * Can verify either specific contracts or all contracts from deployments directory.
 *
 * @param contracts - Optional array of specific contracts to verify. If not provided,
 *                    will verify all contracts from the deployments/{network} directory.
 */
async function verify(contracts?: ContractToVerify[]): Promise<void> {
    const skippedNetworks: string[] = [
        'hardhat',
        'localhost',
        'external-hardhat',
        'dev-native',
        'dev-token',
    ];
    if (skippedNetworks.includes(hre.network.name)) {
        console.log(`\nSkipping verification on development network: ${hre.network.name}`);
        return;
    }

    const contractsToVerify =
        contracts && contracts.length > 0 ? contracts : await getContractsFromDeployments();

    console.log('\n=== Verifying contracts on block explorer ===');
    console.log(`Contracts to verify: ${contractsToVerify.map((c) => c.name).join(', ')}`);
    console.log('Waiting for block explorer to index the contracts...');
    await new Promise((resolve) => setTimeout(resolve, 60000));

    for (const contract of contractsToVerify) {
        try {
            await hre.run('verify:verify', {
                address: contract.address,
                constructorArguments: contract.constructorArguments || [],
            });
            console.log(`${contract.name} verified successfully`);
        } catch (error: any) {
            console.error(`Error verifying ${contract.name}:`, error.message || error);
            if (
                typeof error.message === 'string' &&
                error.message.includes('has') &&
                error.message.includes('parameters but') &&
                error.message.includes('arguments were provided')
            ) {
                console.error(
                    `${contract.name} requires constructor arguments. Please add them to the deployment artifact.`,
                );
            }
        }
    }
    console.log('\nVerification completed!');
}

/**
 * Attempts to verify contracts without throwing errors.
 * This is useful when verification is optional and should not break the deployment process.
 *
 * @param contracts - Optional array of specific contracts to verify.
 */
async function tryVerify(contracts?: ContractToVerify[]): Promise<void> {
    try {
        await verify(contracts);
    } catch (error) {
        console.error('Verification failed, but continuing with deployment:', error);
    }
}

/**
 * Gets contracts to verify from deployments directory.
 */
async function getContractsFromDeployments(): Promise<ContractToVerify[]> {
    const jsonExtension = '.json';
    const contractNames = fs
        .readdirSync(path.resolve(__dirname, `../deployments/${hre.network.name}`))
        .filter((file) => file.endsWith(jsonExtension))
        .map((filePath) => filePath.replace(jsonExtension, ''));

    if (contractNames.length === 0) {
        console.log(`\nNo contracts to verify on network: ${hre.network.name}`);
        return [];
    }

    const contracts: ContractToVerify[] = [];
    for (const contractName of contractNames) {
        const deployment = await deployments.get(contractName);
        contracts.push({
            name: contractName,
            address: deployment.address,
            constructorArguments: deployment.args || [],
        });
    }
    return contracts;
}

if (require.main === module) {
    verify()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export default verify;
export { tryVerify };
