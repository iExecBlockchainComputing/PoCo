// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import { IexecPocoAccessors__factory, Ownable__factory } from '../typechain';
import { getChainConfig, isArbitrumSepoliaChainId, isFork } from '../utils/config';
import { getDeployerAndOwnerSigners } from '../utils/deploy-tools';

/**
 * Script to transfer ownership of Diamond proxy and registries to a new owner.
 *
 * Usage:
 * 1. Set the NEW_OWNER environment variable to the new owner address
 * 2. Run: npx hardhat run scripts/transfer-ownership.ts --network arbitrumSepolia
 *
 * Example:
 * NEW_OWNER=0x1234567890123456789012345678901234567890 npx hardhat run scripts/transfer-ownership.ts --network arbitrumSepolia
 */
async function main() {
    console.log('=== Transfer Ownership Script ===\n');

    // Get network info
    const { chainId, name: networkName } = await ethers.provider.getNetwork();
    console.log(`Network: ${networkName} (${chainId}) (isFork: ${isFork()})`);

    // Validate network
    if (!isArbitrumSepoliaChainId(chainId) && !isFork()) {
        throw new Error(
            `This script is designed for Arbitrum Sepolia (421614). Current chain: ${chainId}`,
        );
    }

    // Get current owner signer
    const { owner: currentOwner } = await getDeployerAndOwnerSigners();
    console.log(`Current owner signer: ${currentOwner.address}`);

    // Get new owner address from environment variable
    const newOwnerAddress = process.env.NEW_OWNER;
    if (!newOwnerAddress) {
        throw new Error(
            'NEW_OWNER environment variable is required. Example: NEW_OWNER=0x... npx hardhat run scripts/transfer-ownership.ts --network arbitrumSepolia',
        );
    }

    if (!ethers.isAddress(newOwnerAddress)) {
        throw new Error(`Invalid NEW_OWNER address: ${newOwnerAddress}`);
    }

    console.log(`New owner address: ${newOwnerAddress}\n`);

    // Get deployed contract addresses from config
    const chainConfig = getChainConfig(chainId);
    const deploymentOptions = chainConfig.v5;

    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy address not found in config');
    }

    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Diamond Proxy: ${diamondProxyAddress}`);

    // Get registry addresses from the Diamond proxy
    const iexecPoco = IexecPocoAccessors__factory.connect(diamondProxyAddress, ethers.provider);
    const appRegistryAddress = await iexecPoco.appregistry();
    const datasetRegistryAddress = await iexecPoco.datasetregistry();
    const workerpoolRegistryAddress = await iexecPoco.workerpoolregistry();

    console.log(`App Registry: ${appRegistryAddress}`);
    console.log(`Dataset Registry: ${datasetRegistryAddress}`);
    console.log(`Workerpool Registry: ${workerpoolRegistryAddress}\n`);

    // Contracts to transfer
    const contracts = [
        { name: 'Diamond Proxy', address: diamondProxyAddress },
        { name: 'App Registry', address: appRegistryAddress },
        { name: 'Dataset Registry', address: datasetRegistryAddress },
        { name: 'Workerpool Registry', address: workerpoolRegistryAddress },
    ];

    // Verify current ownership and transfer
    console.log('=== Verifying current ownership ===\n');
    for (const contract of contracts) {
        const ownable = Ownable__factory.connect(contract.address, ethers.provider);
        const currentOnchainOwner = await ownable.owner();
        console.log(`${contract.name}:`);
        console.log(`  Current onchain owner: ${currentOnchainOwner}`);

        if (currentOnchainOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
            console.log(`  ⚠️  Already owned by new owner, skipping...\n`);
            continue;
        }

        if (currentOnchainOwner.toLowerCase() !== currentOwner.address.toLowerCase()) {
            console.log(
                `  ⚠️  Warning: Current signer (${currentOwner.address}) is not the onchain owner (${currentOnchainOwner})`,
            );
            if (isFork()) {
                console.log(`  Using impersonated signer for fork...`);
                const impersonatedOwner = await ethers.getImpersonatedSigner(currentOnchainOwner);
                // Fund the impersonated owner with ETH from the deployer for gas fees
                const fundingAmount = ethers.parseEther('1'); // 1 ETH should be enough
                console.log(
                    `  Funding impersonated owner with ${ethers.formatEther(fundingAmount)} ETH for gas...`,
                );
                await currentOwner
                    .sendTransaction({
                        to: currentOnchainOwner,
                        value: fundingAmount,
                    })
                    .then((tx) => tx.wait());
                console.log(`  ✅ Funded successfully\n`);
                await transferOwnership(contract, impersonatedOwner, newOwnerAddress);
            } else {
                throw new Error(
                    `Current signer does not match onchain owner. Cannot transfer ownership.`,
                );
            }
        } else {
            await transferOwnership(contract, currentOwner, newOwnerAddress);
        }
    }

    console.log('\n=== Verifying new ownership ===\n');
    for (const contract of contracts) {
        const ownable = Ownable__factory.connect(contract.address, ethers.provider);
        const newOnchainOwner = await ownable.owner();
        console.log(`${contract.name}: ${newOnchainOwner}`);

        if (newOnchainOwner.toLowerCase() !== newOwnerAddress.toLowerCase()) {
            throw new Error(
                `Ownership transfer failed for ${contract.name}. Expected: ${newOwnerAddress}, Got: ${newOnchainOwner}`,
            );
        }
    }

    console.log('\n✅ All ownership transfers completed successfully!');
}

async function transferOwnership(
    contract: { name: string; address: string },
    currentOwner: any,
    newOwnerAddress: string,
) {
    console.log(`  Transferring ownership to ${newOwnerAddress}...`);
    const ownable = Ownable__factory.connect(contract.address, currentOwner);
    const tx = await ownable.transferOwnership(newOwnerAddress);
    console.log(`  Transaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Transfer successful (block: ${receipt?.blockNumber})\n`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
