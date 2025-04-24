// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>

import fs from 'fs-extra';
import path from 'path';

/**
 * Dev Note: Copies contract deployments from a specified network to the Hardhat environment.
 * Enables local testing against actual deployed contracts by duplicating ABIs, addresses, etc.
 * Useful for local development against production contracts and forked network testing.
 */

/**
 * Copies deployment files from source network to hardhat environment
 * @param sourceNetwork The name of the network to copy deployments from
 * @returns true if copy successful, false otherwise
 */
export async function copyDeployments(sourceNetwork: string): Promise<boolean> {
    if (!sourceNetwork) {
        console.error('No source network provided.');
        return false;
    }

    console.log(`Copying deployments for ${sourceNetwork}...`);

    const sourcePath = path.join('deployments', sourceNetwork);
    const destPath = path.join('deployments', 'hardhat');

    if (!fs.existsSync(sourcePath)) {
        console.log(`Source deployment directory ${sourcePath} doesn't exist. Skipping copy.`);
        return false;
    }

    fs.ensureDirSync(destPath);
    fs.copySync(sourcePath, destPath);
    console.log(`Copied deployment files from ${sourcePath} to ${destPath}`);
    return true;
}

/**
 * Cleans up copied deployment files
 * @param networkName The name of the network whose deployment files were copied
 * @returns true if cleanup successful, false otherwise
 */
export async function cleanupDeployments(networkName: string): Promise<boolean> {
    console.log(`Cleaning up copied deployments for ${networkName}...`);

    // Use __dirname equivalent for ESM
    const rootDir = process.cwd();
    const deploymentsDir = path.join(rootDir, 'deployments', 'hardhat');

    if (fs.existsSync(deploymentsDir)) {
        try {
            const files = fs.readdirSync(deploymentsDir);
            for (const file of files) {
                fs.unlinkSync(path.join(deploymentsDir, file));
            }
            console.log('Deployment files cleaned up successfully.');
            return true;
        } catch (error) {
            console.error('Error cleaning up deployment files:', error);
            return false;
        }
    }

    return false;
}

// When script is run directly
if (require.main === module) {
    let sourceNetwork: string | undefined;

    if (process.argv.length > 2) {
        sourceNetwork = process.argv[2];
    }

    if (!sourceNetwork && process.env.HARDHAT_NETWORK_ARGS) {
        try {
            const args = JSON.parse(process.env.HARDHAT_NETWORK_ARGS);
            sourceNetwork = args[0];
        } catch (e) {
            console.error('Failed to parse HARDHAT_NETWORK_ARGS', e);
        }
    }

    if (!sourceNetwork) {
        console.error('No source network provided.');
        process.exit(1);
    }

    copyDeployments(sourceNetwork)
        .then((success) => process.exit(success ? 0 : 1))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
