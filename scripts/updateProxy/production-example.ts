// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre from 'hardhat';
import { IexecPocoAccessorsFacet__factory } from '../../typechain';
import config from '../../utils/config';
import { COMMON_SELECTORS, createUpdateSummary, validateDiamondUpdate } from './diamond-utils';
import { updateDiamondProxy } from './generic-diamond-update';

/**
 * Production-ready diamond update script with validation and utilities
 */
(async () => {
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    const diamondAddress = deploymentOptions.DiamondProxy;

    if (!diamondAddress) {
        throw new Error('DiamondProxy not found in config');
    }

    // Define the update configuration
    const updateConfig = {
        description: 'Remove legacy accessor functions and add new IexecPocoAccessorsFacet',
        facetsToRemove: [
            {
                name: 'LegacyERC20Functions',
                factory: null,
                selectorsToRemove: [
                    COMMON_SELECTORS.ERC20_BALANCE_OF,
                    COMMON_SELECTORS.ERC20_NAME,
                    COMMON_SELECTORS.ERC20_SYMBOL,
                    COMMON_SELECTORS.ERC20_DECIMALS,
                    COMMON_SELECTORS.ERC20_TOTAL_SUPPLY,
                    COMMON_SELECTORS.ERC20_ALLOWANCE,
                ],
            },
            {
                name: 'OldPocoConstants',
                factory: null,
                selectorsToRemove: [
                    '0x7b244832', // CONTRIBUTION_DEADLINE_RATIO()
                    '0x5fde601d', // REVEAL_DEADLINE_RATIO()
                    '0x90fc26b1', // FINAL_DEADLINE_RATIO()
                    '0x4ec3b9e3', // WORKERPOOL_STAKE_RATIO()
                    '0x51152de1', // KITTY_RATIO()
                    '0xe2e7a8c1', // KITTY_MIN()
                    '0x9e986e81', // KITTY_ADDRESS()
                    '0x68a9ef1c', // GROUPMEMBER_PURPOSE()
                ],
            },
            {
                name: 'MiscellaneousFunctions',
                factory: null,
                selectorsToRemove: [
                    '0x9910fd72', // workerpoolByIndex()
                    '0xdb8aaa26', // appByIndex()
                    '0x1bf6e00d', // datasetByIndex()
                    '0x66517ca6', // ComputeDealVolume
                ],
            },
        ],
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
                saveDeployment: true,
            },
        ],
        verbose: true,
    };

    console.log('🔍 Validating diamond update configuration...');

    // Validate the configuration
    const validation = await validateDiamondUpdate(diamondAddress, updateConfig);

    if (!validation.isValid) {
        console.error('❌ Validation failed:');
        validation.errors.forEach((error) => console.error(`  - ${error}`));
        process.exit(1);
    }

    if (validation.warnings.length > 0) {
        console.warn('⚠️  Validation warnings:');
        validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    // Create and display summary
    const summary = await createUpdateSummary(diamondAddress, updateConfig);

    console.log('\n📊 Update Summary:');
    console.log('='.repeat(50));
    console.log(`Functions to remove: ${summary.functionsToRemove}`);
    console.log(`Functions to add: ${summary.functionsToAdd}`);
    console.log(`Facets to process for removal: ${summary.facetsToRemove}`);
    console.log(`Facets to add: ${summary.facetsToAdd}`);
    console.log(`Affected facets: ${summary.affectedFacets.length}`);

    if (summary.affectedFacets.length > 0) {
        console.log('\nAffected facet addresses:');
        summary.affectedFacets.forEach((addr) => console.log(`  - ${addr}`));
    }

    console.log('='.repeat(50));

    // Ask for confirmation (in a real script, you might want to add user input)
    console.log('\n🚀 Proceeding with diamond update...');

    // Execute the update
    await updateDiamondProxy(updateConfig);

    console.log('\n✅ Diamond update completed successfully!');
    console.log('\nBenefits of using the generic script:');
    console.log('  🔧 Completely reusable for any diamond update');
    console.log('  🛡️  Built-in validation and error checking');
    console.log('  📊 Comprehensive logging and progress tracking');
    console.log('  🎯 Supports both complete and selective function management');
    console.log('  ⚡ Automatic conflict detection and resolution');
    console.log('  🔍 Utility functions for diamond inspection');
})().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
