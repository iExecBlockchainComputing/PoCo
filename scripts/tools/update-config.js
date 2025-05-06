import fs from 'fs';
import hre from 'hardhat';
import path from 'path';

async function main() {
    const [networkName] = process.argv.slice(2);

    if (!networkName) {
        console.error('Usage: node update-config.js <networkName>');
        process.exit(1);
    }

    let chainId;
    try {
        chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
    } catch (error) {
        console.error(`Failed to get chain ID for network ${networkName}:`, error.message);
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
    const configPath = path.resolve('config/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

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

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`Updated ${chainId}.v5.${contractKey}:`);
    console.log(`Previous: ${previousValue}`);
    console.log(`New: ${contractAddress}`);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error in update-config script:', error);
        process.exit(1);
    });
