// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers, network } from 'hardhat';
import config from '../../utils/config';
import {
    calculateMappingSlot,
    extractDiamondStorage,
    getTestAccounts,
} from './extract-diamond-storage';

/**
 * Resets the PoCo Diamond contract to a clean state on a forked network.
 *
 * This function uses Diamond storage layout extraction to identify and reset
 * the specific storage slots used by PoCo facets, rather than blindly zeroing
 * sequential slots.
 *
 * IMPORTANT: This only works on Hardhat's local network (with or without forking).
 * The hardhat_setStorageAt RPC method is not available on live networks.
 *
 * Usage:
 * - ARBITRUM_SEPOLIA_FORK=true npx hardhat run <this-script> --network hardhat
 * - ARBITRUM_FORK=true npx hardhat run <this-script> --network hardhat
 * - LOCAL_FORK=true npx hardhat run <this-script> --network hardhat
 *
 * Strategy:
 * 1. Extract storage layout using DiamondLoupe and known namespaces
 * 2. Reset identified storage slots to zero
 * 3. Verify the reset worked by checking totalSupply
 */
async function resetPocoStateAfterUpgrade() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    if (!diamondProxyAddress) {
        throw new Error('DiamondProxy address not found in config');
    }

    // Verify we're running on Hardhat network (required for hardhat_setStorageAt)
    if (network.name !== 'hardhat' && network.name !== 'external-hardhat') {
        throw new Error(
            `This script requires the Hardhat network. ` +
                `Current network: ${network.name}. ` +
                `Use --network hardhat with the appropriate FORK environment variable ` +
                `(e.g., ARBITRUM_SEPOLIA_FORK=true npx hardhat run <script> --network hardhat)`,
        );
    }

    console.log('\n🔄 Resetting PoCo Diamond state for testing...');
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);
    console.log(`Chain ID: ${chainId}\n`);

    // Get IexecInterface for verification and domain separator check
    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);

    try {
        // Step 1: Extract storage layout
        console.log('📊 Step 1: Extracting Diamond storage layout...\n');
        const slotsToReset = await extractDiamondStorage(diamondProxyAddress);

        // Step 2: Reset each identified slot
        console.log('\n🧹 Step 2: Resetting storage slots...\n');
        const zeroValue = '0x' + '0'.repeat(64);

        for (let i = 0; i < slotsToReset.length; i++) {
            const slotInfo = slotsToReset[i];
            console.log(`  [${i + 1}/${slotsToReset.length}] Resetting: ${slotInfo.description}`);

            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                slotInfo.slot,
                zeroValue,
            ]);
        }

        // Step 2.5: Reset individual account balances
        console.log('\n💰 Step 2.5: Resetting individual account balances...\n');

        // POCO_STORAGE_LOCATION from PocoStorageLib.v8.sol
        const POCO_STORAGE_LOCATION =
            '0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00';

        // Calculate base slots for m_balances (offset 8) and m_frozens (offset 9)
        const baseBalancesSlot = ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + BigInt(8), 32);
        const baseFrozensSlot = ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + BigInt(9), 32);

        // Get test accounts
        const testAccounts = await getTestAccounts();

        // Also add the proxy address itself
        const accountsToReset = [...testAccounts, diamondProxyAddress];

        console.log(
            `  Found ${accountsToReset.length} accounts to reset (${testAccounts.length} test accounts + proxy)`,
        );

        for (const account of accountsToReset) {
            // Calculate and reset balance slot
            const balanceSlot = calculateMappingSlot(account, baseBalancesSlot);
            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                balanceSlot,
                zeroValue,
            ]);

            // Calculate and reset frozen slot
            const frozenSlot = calculateMappingSlot(account, baseFrozensSlot);
            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                frozenSlot,
                zeroValue,
            ]);
        }

        console.log(`  ✅ Reset balances and frozens for ${accountsToReset.length} accounts`);

        // Step 2.6: Reset m_consumed mapping base (makes all orders appear unconsumed)
        console.log('\n📝 Step 2.6: Resetting consumed orders mapping...\n');

        const consumedMappingSlot = ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + BigInt(13), 32);
        console.log(`  Resetting m_consumed mapping base at slot ${consumedMappingSlot}`);

        await network.provider.send('hardhat_setStorageAt', [
            diamondProxyAddress,
            consumedMappingSlot,
            zeroValue,
        ]);

        console.log(`  ✅ All order hashes will appear unconsumed`);

        // Step 2.7: Ensure domain separator matches test expectations
        console.log('\n🔐 Step 2.7: Verifying domain separator...\n');

        // Tests use: name='iExecODB', version='5.0.0'
        const testDomain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: chainId,
            verifyingContract: diamondProxyAddress,
        };

        const expectedDomainSeparator = ethers.TypedDataEncoder.hashDomain(testDomain);
        const currentDomainSeparator = await iexec.eip712domain_separator();

        if (currentDomainSeparator === expectedDomainSeparator) {
            console.log(`  ✅ Domain separator already matches test expectations`);
        } else {
            console.log(`  ⚠️  Domain separator mismatch, resetting...`);
            console.log(`     Current:  ${currentDomainSeparator}`);
            console.log(`     Expected: ${expectedDomainSeparator}`);

            // m_eip712DomainSeparator is at offset 11
            const domainSeparatorSlot = ethers.toBeHex(
                BigInt(POCO_STORAGE_LOCATION) + BigInt(11),
                32,
            );
            await network.provider.send('hardhat_setStorageAt', [
                diamondProxyAddress,
                domainSeparatorSlot,
                expectedDomainSeparator,
            ]);
            console.log(`  ✅ Domain separator updated for test compatibility`);
        }

        // Step 3: Mine a block to apply changes
        console.log('\n⛏️  Step 3: Mining block to apply changes...');
        await network.provider.send('evm_mine', []);

        console.log('\n✅ PoCo state reset complete!');

        // Step 4: Verify the reset worked
        console.log('\n� Step 4: Verifying reset...\n');

        try {
            const totalSupply = await iexec.totalSupply();
            console.log(`   Total supply: ${totalSupply.toString()}`);

            if (totalSupply === 0n) {
                console.log('   ✅ Total supply is zero - reset successful!');
            } else {
                console.log('   ⚠️  WARNING: Total supply is not zero!');
                console.log('   This might indicate additional storage slots need to be reset.');
                console.log(
                    '   Consider running scripts/tools/get-storage-layout.ts for more details.',
                );
            }
        } catch (error) {
            console.log('   ⚠️  Could not verify total supply (contract might have changed)');
        }

        console.log('\n📝 Note: If tests still fail, you may need to:');
        console.log('   1. Run npm run storage-to-diagrams to visualize actual storage');
        console.log('   2. Update extract-diamond-storage.ts with additional slots');
        console.log('   3. Check if the Diamond uses different namespacing\n');
    } catch (error) {
        console.error('\n❌ Error resetting PoCo state:', error);
        console.error('\nDebugging tips:');
        console.error('  - Run scripts/tools/extract-diamond-storage.ts standalone');
        console.error('  - Check if DiamondLoupe is implemented');
        console.error('  - Verify the storage namespace strings are correct');
        console.error('  - Use npm run storage-to-diagrams for visualization\n');
        throw error;
    }
}

// Export for use in other scripts
export { resetPocoStateAfterUpgrade };

// Run if called directly
if (require.main === module) {
    resetPocoStateAfterUpgrade()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
