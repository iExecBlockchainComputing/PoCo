// scripts/copy-deployments.js
const fs = require('fs-extra');
const path = require('path');

// Get source network from command-line argument
const sourceNetwork = process.argv[2];

const sourcePath = path.join('deployments', sourceNetwork);
const destPath = path.join('deployments', 'hardhat');

// Check if source directory exists
if (!fs.existsSync(sourcePath)) {
    console.log(`Source deployment directory ${sourcePath} doesn't exist. Skipping copy.`);
    process.exit(0); // Exit normally
}

// Ensure destination directory exists
fs.ensureDirSync(destPath);

// Copy all deployment files
fs.copySync(sourcePath, destPath);

console.log(`Copied deployment files from ${sourcePath} to ${destPath}`);
