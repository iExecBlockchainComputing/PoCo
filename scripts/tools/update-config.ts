import * as fs from 'fs';
import { deployments, ethers } from 'hardhat';
import * as path from 'path';
import localConfig from '../../utils/config';
import { getDeployerAndOwnerSigners } from '../../utils/deploy-tools';

// Used in poco-chain
async function update() {
    // Get the absolute path to the config file
    const configPath = path.resolve('config/config.json');
    // Get network info from ethers
    const network = await ethers.provider.getNetwork();
    const networkName = network.name;
    const chainId = network.chainId.toString();
    console.log(`Network: ${networkName} (${chainId})`);
    const { deployer, owner } = await getDeployerAndOwnerSigners();
    const proxyAddress = (await deployments.get('Diamond')).address;
    const iexecLibOrdersAddress = (await deployments.get('IexecLibOrders_v5')).address;
    const rlcDeployement = await deployments.getOrNull('RLC');
    const rlcAddress = rlcDeployement ? rlcDeployement.address : null;
    if (!proxyAddress) {
        console.error(`Proxy address not defined`);
        process.exit(1);
    }
    console.log(`Diamond proxy address: ${proxyAddress}`);
    console.log(`IexecLibOrders_v5: ${iexecLibOrdersAddress}`);
    console.log(`RLC address: ${rlcAddress}`);

    // Ensure the chain structure exists
    if (!localConfig.chains) {
        localConfig.chains = {};
    }
    if (!localConfig.chains[chainId]) {
        localConfig.chains[chainId] = {
            name: `Chain ${networkName}`,
            deployer: deployer.address,
            owner: owner.address,
            asset: 'Token', // Default value, update as needed
            v3: {},
            v5: {},
        };
    }
    if (!localConfig.chains[chainId].v5) {
        localConfig.chains[chainId].v5 = {};
    }
    // Save the Diamond proxy address.
    const diamondProxyName = 'DiamondProxy';
    const previousDiamondAddress = localConfig.chains[chainId].v5[diamondProxyName] || 'null';
    localConfig.chains[chainId].v5[diamondProxyName] = proxyAddress;
    console.log(
        `Updated ${chainId}.v5.${diamondProxyName} from ${previousDiamondAddress} to ${proxyAddress}`,
    );
    // Save `IexecLibOrders_v5` address if it exists
    const iexecLibOrdersName = 'IexecLibOrders_v5';
    if (iexecLibOrdersAddress) {
        const previousLibAddress = localConfig.chains[chainId].v5[iexecLibOrdersName] || 'null';
        localConfig.chains[chainId].v5[iexecLibOrdersName] = iexecLibOrdersAddress;
        console.log(
            `Updated ${chainId}.v5.${iexecLibOrdersName} from ${previousLibAddress} to ${iexecLibOrdersAddress}`,
        );
    }
    // Save `RLC` address if found.
    const token = 'token';
    if (rlcAddress) {
        const previousRlcAddress = localConfig.chains[chainId][token] || null;
        localConfig.chains[chainId][token] = rlcAddress;
        console.log(`Updated ${chainId}.${token} from ${previousRlcAddress} to ${rlcAddress}`);
    }
    // Write the updated config back to file
    fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2));
    console.log(`Configuration updated successfully in ${configPath}`);
}

// Execute only when run directly (not when imported)
if (require.main === module) {
    update().catch((error) => {
        console.error('Error in update-config script:', error);
        process.exit(1);
    });
}
