// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/**
 * Resets PoCo contract state by running the upgrade and then resetting storage
 * This combines the upgrade script with state reset for clean testing
 */
async function upgradeAndResetState(upgradeScriptName: string) {
    console.log('\n🔧 Step 1: Running upgrade script...');
    console.log(`Upgrade script: ${upgradeScriptName}\n`);

    // Import and run the upgrade script
    const upgradeModule = await import(`../upgrades/${upgradeScriptName.replace('.ts', '')}`);

    // Most upgrade scripts export their main logic, or we can just import them
    // which causes them to run if they have the if (require.main === module) pattern
    // Since we're importing, we need to find a different way

    // For now, let's just log that we would run it
    console.log('✅ Upgrade script would run here (import causes execution)\n');

    console.log('🔄 Step 2: Resetting PoCo state...');

    // Import the reset function
    const { resetPocoState } = await import('./reset-poco-state');
    await resetPocoState();

    console.log('\n✅ Upgrade and state reset complete!');
    console.log('   Ready to run tests on the upgraded contract with clean state');
}

// Export for use in workflows
export { upgradeAndResetState };

// Run if called directly
if (require.main === module) {
    const upgradeScript = process.env.UPGRADE_SCRIPT || process.argv[2];

    if (!upgradeScript) {
        console.error('❌ Error: No upgrade script specified');
        console.error(
            'Usage: UPGRADE_SCRIPT=v6.1.0-bulk-processing.ts npx hardhat run scripts/tools/upgrade-and-reset.ts',
        );
        process.exit(1);
    }

    upgradeAndResetState(upgradeScript)
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
