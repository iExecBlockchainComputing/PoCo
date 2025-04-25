// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import hre, { deployments } from 'hardhat';
import path from 'path';

(async () => {
    const jsonExtension = '.json';
    const contractNames = fs
        .readdirSync(path.resolve(__dirname, `../deployments/${hre.network.name}`))
        .filter((file) => file.endsWith(jsonExtension))
        .map((filePath) => filePath.replace(jsonExtension, ''));

    console.log(`Contracts to verify: ${contractNames}`);

    for (const contractName of contractNames) {
        try {
            console.log(`Verifying ${contractName}..`);
            const deployment = await deployments.get(contractName);
            const address = deployment.address;
            const constructorArguments = deployment.args || [];
            await hre.run('verify:verify', {
                address,
                constructorArguments,
            });

            console.log(`${contractName} verified successfully`);
        } catch (error: any) {
            console.error(`Error verifying ${contractName}:`, error.message || error);
            if (
                typeof error.message === 'string' &&
                error.message.includes('has') &&
                error.message.includes('parameters but') &&
                error.message.includes('arguments were provided')
            ) {
                console.error(
                    `${contractName} requires constructor arguments. Please add them to the deployment artifact.`,
                );
            }
        }
    }
})();
