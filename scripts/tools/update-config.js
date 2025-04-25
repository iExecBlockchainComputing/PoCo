import fs from "fs";
import path from "path";

// Map network names to chain IDs
const NETWORK_TO_CHAIN_ID = {
  hardhat: "31337",
  avalancheFujiTestnet: "43113",
  arbitrumSepolia: "421614",
  bellecour: "134"
};

// Get arguments from command line
const [networkName, contractKey, contractAddress] = process.argv.slice(2);

if (!networkName || !contractKey || !contractAddress) {
  console.error("Usage: node update-config.js <networkName> <contractKey> <address>");
  process.exit(1);
}

const chainId = NETWORK_TO_CHAIN_ID[networkName];
if (!chainId) {
  console.error(`Unknown network: ${networkName}`);
  process.exit(1);
}

// Read config file
const configPath = path.resolve("config/config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Ensure the chain structure exists
if (!config.chains) {
  config.chains = {};
}

if (!config.chains[chainId]) {
  config.chains[chainId] = {
    v5: {}
  };
}

if (!config.chains[chainId].v5) {
  config.chains[chainId].v5 = {};
}

// Update the contract address
const previousValue = config.chains[chainId].v5[contractKey] || "null";
config.chains[chainId].v5[contractKey] = contractAddress;

// Write the updated config back to file
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`Updated ${chainId}.v5.${contractKey}:`);
console.log(`Previous: ${previousValue}`);
console.log(`New: ${contractAddress}`);
