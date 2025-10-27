// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/**
 * Combined script to:
 * 1. Run an upgrade script on a forked network
 * 2. Reset the PoCo contract state to clean slate
 * 3. Run the full test suite
 *
 * This must all happen in a single Hardhat process to maintain fork state.
 *
 * Usage:
 * UPGRADE_SCRIPT=v6.1.0-bulk-processing.ts ARBITRUM_SEPOLIA_FORK=true npx hardhat test
 */

import { resetPocoStateAfterUpgrade } from './reset-poco-state-after-upgrade';

/**
 * This function runs before all tests when UPGRADE_SCRIPT env var is set
 * It's designed to be called from a test setup file
 */
export async function runUpgradeAndReset() {
    const upgradeScript = process.env.UPGRADE_SCRIPT;

    if (!upgradeScript) {
        console.log('ℹ️  No UPGRADE_SCRIPT specified, skipping upgrade step');
        return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔧 PRE-TEST SETUP: Upgrade and State Reset');
    console.log('='.repeat(80));

    try {
        // Step 1: Run the upgrade script
        console.log(`\n📝 Step 1/3: Running upgrade script: ${upgradeScript}`);
        console.log('-'.repeat(80));

        const upgradeModulePath = `../upgrades/${upgradeScript.replace('.ts', '').replace('.js', '')}`;
        const upgradeModule = await import(upgradeModulePath);

        // If the module exports a default function or main function, call it
        if (typeof upgradeModule.default === 'function') {
            await upgradeModule.default();
        } else if (typeof upgradeModule.main === 'function') {
            await upgradeModule.main();
        } else {
            console.log('⚠️  Upgrade module loaded (may have executed on import)');
        }

        console.log('✅ Upgrade completed successfully\n');

        // Step 2: Reset state
        console.log('🔄 Step 2/3: Resetting PoCo contract state...');
        console.log('-'.repeat(80));
        await resetPocoStateAfterUpgrade();
        console.log('✅ State reset completed\n');

        // Step 3: Ready for tests
        console.log('✅ Step 3/3: Ready to run tests');
        console.log('-'.repeat(80));
        console.log('   Upgraded contract with clean state');
        console.log('   Test suite will now run...\n');
        console.log('='.repeat(80) + '\n');
    } catch (error) {
        console.error('\n❌ Error during upgrade and reset:', error);
        throw error;
    }
}

// Export for use in test setup
export { resetPocoStateAfterUpgrade };
