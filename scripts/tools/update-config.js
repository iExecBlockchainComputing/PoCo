import fs from 'fs';
import path from 'path';

// Map network names to chain IDs
const NETWORK_TO_CHAIN_ID = {
    hardhat: '31337',
    avalancheFujiTestnet: '43113',
    arbitrumSepolia: '421614',
    bellecour: '134',
};

const [networkName] = process.argv.slice(2);

if (!networkName) {
    console.error('Usage: node update-config.js <networkName>');
    process.exit(1);
}

const chainId = NETWORK_TO_CHAIN_ID[networkName];
if (!chainId) {
    console.error(`Unknown network: ${networkName}`);
    process.exit(1);
}

const deploymentPath = path.resolve(`deployments/${networkName}/ERC1538Proxy.json`);
if (!fs.existsSync(deploymentPath)) {
    console.error(`ERC1538Proxy deployment file not found for network: ${networkName}`);
    process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const contractAddress = deployment.address;

if (!contractAddress || contractAddress === 'null') {
    console.error(`Failed to extract a valid ERC1538Proxy address from deployment file`);
    process.exit(1);
}

console.log(`Found ERC1538Proxy address: ${contractAddress}`);

// Read config file
const configPath = path.resolve('config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Ensure the chain structure exists
if (!config.chains) {
    config.chains = {};
}

if (!config.chains[chainId]) {
    config.chains[chainId] = {
        v5: {},
    };
}

if (!config.chains[chainId].v5) {
    config.chains[chainId].v5 = {};
}

const contractKey = 'ERC1538Proxy';
const previousValue = config.chains[chainId].v5[contractKey] || 'null';
config.chains[chainId].v5[contractKey] = contractAddress;

// Write the updated config back to file
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`Updated ${chainId}.v5.${contractKey}:`);
console.log(`Previous: ${previousValue}`);
console.log(`New: ${contractAddress}`);
