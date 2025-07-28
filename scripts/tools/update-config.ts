import * as fs from 'fs';
import { deployments, ethers } from 'hardhat';
import * as path from 'path';
import localConfig from '../../utils/config';

async function main(): Promise<void> {
    // Get the absolute path to the config file
    const configPath = path.resolve('config/config.json');
    // Get network info from ethers
    const network = await ethers.provider.getNetwork();
    const networkName = network.name;
    const chainId = network.chainId.toString();

    console.log(`Working with network: ${networkName} (Chain ID: ${chainId})`);
    const deployment = await deployments.get('Diamond');
    const contractAddress = deployment.address;

    if (!contractAddress || contractAddress === 'null') {
        console.error(`Failed to extract a valid Diamond proxy address from Hardhat deployment`);
        process.exit(1);
    }
    console.log(`Diamond proxy address to save: ${contractAddress}`);

    // Ensure the chain structure exists
    if (!localConfig.chains) {
        localConfig.chains = {};
    }
    if (!localConfig.chains[chainId]) {
        localConfig.chains[chainId] = {
            _comment: `Chain ${networkName} (${chainId})`,
            asset: 'Token', // Default value, update as needed
            v3: {
                Hub: null,
                AppRegistry: null,
                DatasetRegistry: null,
                WorkerpoolRegistry: null,
            },
            v5: {},
        };
    }
    if (!localConfig.chains[chainId].v5) {
        localConfig.chains[chainId].v5 = {};
    }
    // Save the Diamond proxy address.
    const diamondProxyName = 'DiamondProxy';
    const previousDiamondAddress = localConfig.chains[chainId].v5[diamondProxyName] || 'null';
    localConfig.chains[chainId].v5[diamondProxyName] = contractAddress;
    console.log(
        `Updated ${chainId}.v5.${diamondProxyName} from ${previousDiamondAddress} to ${contractAddress}`,
    );
    // Save `IexecLibOrders_v5` address if it exists
    const iexecLibOrdersName = 'IexecLibOrders_v5';
    const iexecLibOrdersDeployment = await deployments.get(iexecLibOrdersName);
    if (iexecLibOrdersDeployment && iexecLibOrdersDeployment.address) {
        const previousLibAddress = localConfig.chains[chainId].v5[iexecLibOrdersName] || 'null';
        localConfig.chains[chainId].v5[iexecLibOrdersName] = iexecLibOrdersDeployment.address;
        console.log(
            `Updated ${chainId}.v5.${iexecLibOrdersName} from ${previousLibAddress} to ${iexecLibOrdersDeployment.address}`,
        );
    }
    // Write the updated config back to file
    fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2));
    console.log(`Configuration updated successfully in ${configPath}`);
}

// Execute the main function and handle any errors
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error in update-config script:', error);
        process.exit(1);
    });
