// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import hre, { deployments } from 'hardhat';
import path from 'path';

(async () => {
    const jsonExtension = '.json';
    const contractNames = fs
        .readdirSync(path.resolve(__dirname, `../../deployments/${hre.network.name}`))
        .filter((file) => file.endsWith(jsonExtension))
        .map((filePath) => filePath.replace(jsonExtension, ''));
    console.log(`Contracts to verify: ${contractNames}`);
    for (const contractName of contractNames) {
        console.log(`Verifying ${contractName}..`);
        const address = (await deployments.get(contractName)).address;
        await hre.run('verify:verify', {
            address,
        });
    }
})();
