// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>

/**
    Dev Note: Copies contract deployments from a specified network to the Hardhat environment.
    Enables local testing against actual deployed contracts by duplicating ABIs, addresses, etc.
    Useful for local development against production contracts and forked network testing.
*/

const fs = require('fs-extra');
const path = require('path');
const sourceNetwork = process.argv[2];

const sourcePath = path.join('deployments', sourceNetwork);
const destPath = path.join('deployments', 'hardhat');

if (!fs.existsSync(sourcePath)) {
    console.log(`Source deployment directory ${sourcePath} doesn't exist. Skipping copy.`);
    process.exit(0); // Exit normally
}

fs.ensureDirSync(destPath);

fs.copySync(sourcePath, destPath);

console.log(`Copied deployment files from ${sourcePath} to ${destPath}`);
