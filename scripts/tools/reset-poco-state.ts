// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers, network } from 'hardhat';
import config from '../../utils/config';

/**
 * Helper function to convert number to bytes32 hex string
 */
function toBytes32(value: number | bigint): string {
    return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

/**
 * Helper function to get storage slot for a mapping
 * keccak256(abi.encode(key, slot))
 */
function getMappingSlot(key: string, mappingSlot: number): string {
    return ethers.keccak256(
        ethers.concat([
            ethers.zeroPadValue(key, 32),
            ethers.zeroPadValue(ethers.toBeHex(mappingSlot), 32),
        ]),
    );
}

/**
 * Resets the state of the PoCo Diamond contract on a forked network
 * This allows running tests on a fork with clean state after an upgrade
 */
async function resetPocoState() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    if (!diamondProxyAddress) {
        throw new Error('DiamondProxy address not found in config');
    }

    console.log('\n🔄 Resetting PoCo Diamond state...');
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);
    console.log(`Chain ID: ${chainId}`);

    // Diamond storage layout (from contracts/Diamond.sol and facets)
    // These are approximate slot numbers - adjust based on actual storage layout
    const storageSlots = {
        // IexecEscrow storage (from IexecEscrowStorage)
        totalSupply: 0, // m_totalSupply
        // Note: m_balances and m_frozens are mappings, we'll reset specific addresses if needed

        // Common storage slots that might need resetting
        // Add more based on your contract's storage layout
    };

    try {
        // Reset total supply to 0
        console.log('Resetting total supply to 0...');
        await network.provider.send('hardhat_setStorageAt', [
            diamondProxyAddress,
            toBytes32(storageSlots.totalSupply),
            toBytes32(0),
        ]);

        // Reset specific account balances if needed
        // Example: Reset balances for test accounts
        const accounts = await ethers.getSigners();
        const accountsToReset = accounts.slice(0, 20); // Reset first 20 accounts

        console.log(`Resetting balances for ${accountsToReset.length} accounts...`);
        for (const account of accountsToReset) {
            const address = await account.getAddress();

            // Reset balance mapping (slot 1 in most implementations)
            // m_balances mapping
            const balanceSlot = getMappingSlot(address, 1);
            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                balanceSlot,
                toBytes32(0),
            ]);

            // Reset frozen mapping (slot 2)
            // m_frozens mapping
            const frozenSlot = getMappingSlot(address, 2);
            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                frozenSlot,
                toBytes32(0),
            ]);
        }

        // Reset callback gas to default value (100000)
        // This is stored in IexecPocoStorage, typically at slot offset
        // You may need to adjust the slot number based on actual storage layout
        console.log('Resetting callback gas to default (100000)...');
        // Note: The exact slot depends on the facet storage layout
        // This is a placeholder - you'll need to determine the correct slot
        const callbackGasSlot = 10; // Adjust based on actual layout
        await network.provider.send('hardhat_setStorageAt', [
            diamondProxyAddress,
            toBytes32(callbackGasSlot),
            toBytes32(100000),
        ]);

        // Mine a block to apply all changes
        console.log('Mining block to apply state changes...');
        await network.provider.send('evm_mine', []);

        console.log('✅ PoCo state reset complete!');
        console.log('   - Total supply: 0');
        console.log(`   - ${accountsToReset.length} account balances reset`);
        console.log('   - Callback gas: 100000');
    } catch (error) {
        console.error('❌ Error resetting PoCo state:', error);
        throw error;
    }
}

/**
 * Advanced reset: Reset all storage slots (nuclear option)
 * WARNING: This will completely wipe the contract state
 */
async function resetAllStorage(contractAddress: string, numberOfSlots: number = 100) {
    console.log(
        `\n⚠️  WARNING: Resetting ALL storage slots (0-${numberOfSlots}) for ${contractAddress}`,
    );

    for (let i = 0; i < numberOfSlots; i++) {
        await network.provider.send('hardhat_setStorageAt', [
            contractAddress,
            toBytes32(i),
            toBytes32(0),
        ]);
    }

    await network.provider.send('evm_mine', []);
    console.log('✅ All storage slots reset');
}

// Export for use in other scripts
export { resetPocoState, resetAllStorage };

// Run if called directly
if (require.main === module) {
    resetPocoState()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
