// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { execSync } from 'child_process';
import { ethers } from 'hardhat';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
    console.log('Starting Diamond Proxy Update Process...');
    console.log(`Network: ${networkName} (Chain ID: ${chainId})`);
    console.log('='.repeat(60));

    try {
        console.log('Step 1: Deploying updated IexecPocoAccessorsFacet...');
        execSync(
            `npx hardhat run scripts/updateProxy/0_deploy-updated-accessor-facet.ts --network ${networkName}`,
            { stdio: 'inherit' },
        );

        console.log('Step 2: Updating diamond proxy...');
        execSync(
            `npx hardhat run scripts/updateProxy/1_update-proxy-with-new-facet.ts --network ${networkName}`,
            { stdio: 'inherit' },
        );

        console.log('\\n' + '='.repeat(60));
    } catch (error) {
        console.error('Error during proxy update:');
        console.error(error);
        process.exit(1);
    }
})();
