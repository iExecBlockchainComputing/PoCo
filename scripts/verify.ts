// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre, { deployments } from 'hardhat';
import { Deployment } from 'hardhat-deploy/dist/types';

/**
 * Verifies contracts on block explorer (e.g., Etherscan, Arbiscan).
 * Can verify either specific contracts or all contracts from deployments directory.
 *
 * @param contracts - Optional array of specific contracts to verify. If not provided,
 *                    will verify all contracts from the deployments/{network} directory.
 */
async function verify(contractNames?: string[]): Promise<void> {
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
    let contracts: { [name: string]: Deployment } = {};
    if (contractNames) {
        // Get deployments of the specified contract names.
        for (const name of contractNames) {
            contracts[name] = await deployments.get(name);
        }
    } else {
        // If no specific contract names provided, verify all deployments.
        contracts = await deployments.all();
        contractNames = Object.keys(contracts);
    }
    console.log('\n=== Verifying contracts on block explorer ===');
    console.log(`Contracts to verify: ${contractNames.join(', ')}`);
    console.log('Waiting for block explorer to index the contracts...');
    await new Promise((resolve) => setTimeout(resolve, 60000)); // 60s
    for (const name of contractNames) {
        try {
            const contract = contracts[name];
            await hre.run('verify:verify', {
                address: contract.address,
                constructorArguments: contract.args,
            });
            console.log(`${name} verified successfully`);
        } catch (error: any) {
            console.error(`Error verifying ${name}:`, error.message || error);
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
export async function tryVerify(contractNames?: string[]): Promise<void> {
    try {
        await verify(contractNames);
    } catch (error) {
        console.error('Verification failed, but continuing with deployment:', error);
    }
}

if (require.main === module) {
    verify().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
