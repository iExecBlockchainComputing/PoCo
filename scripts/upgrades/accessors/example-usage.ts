// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { IexecPocoAccessorsFacet__factory } from '../../typechain';
import { updateDiamondProxy } from './generic-diamond-update';

/**
 * Example: Update proxy with new facet (converted from original script)
 * This demonstrates how to use the generic diamond update function
 */
(async () => {
    // Example of creating a custom facet to remove based on specific function signatures
    // This simulates the old accessor facets that were being removed in the original script
    class LegacyAccessorFacetFactory {
        static interface = {
            fragments: [
                // Legacy accessor function signatures that need to be removed
                'function balanceOf(address) view returns (uint256)',
                'function name() view returns (string)',
                'function symbol() view returns (string)',
                'function decimals() view returns (uint8)',
                'function totalSupply() view returns (uint256)',
                'function allowance(address,address) view returns (uint256)',
                'function workerpoolByIndex(uint256) view returns (address)',
                'function appByIndex(uint256) view returns (address)',
                'function datasetByIndex(uint256) view returns (address)',
                // Automatic getters from public constants
                'function CONTRIBUTION_DEADLINE_RATIO() view returns (uint256)',
                'function REVEAL_DEADLINE_RATIO() view returns (uint256)',
                'function FINAL_DEADLINE_RATIO() view returns (uint256)',
                'function WORKERPOOL_STAKE_RATIO() view returns (uint256)',
                'function KITTY_RATIO() view returns (uint256)',
                'function KITTY_MIN() view returns (uint256)',
                'function KITTY_ADDRESS() view returns (address)',
                'function GROUPMEMBER_PURPOSE() view returns (uint256)',
            ],
        };
        static getFunction(name: string) {
            const fragment = this.interface.fragments.find((f) => f.includes(name.split('(')[0]));
            if (!fragment) throw new Error(`Function ${name} not found`);
            // Simple selector calculation (you might want to use ethers for this)
            return {
                selector:
                    {
                        'balanceOf(address)': '0x70a08231',
                        'name()': '0x06fdde03',
                        'symbol()': '0x95d89b41',
                        'decimals()': '0x313ce567',
                        'totalSupply()': '0x18160ddd',
                        'allowance(address,address)': '0xdd62ed3e',
                        'workerpoolByIndex(uint256)': '0x9910fd72',
                        'appByIndex(uint256)': '0xdb8aaa26',
                        'datasetByIndex(uint256)': '0x1bf6e00d',
                        'CONTRIBUTION_DEADLINE_RATIO()': '0x7b244832',
                        'REVEAL_DEADLINE_RATIO()': '0x5fde601d',
                        'FINAL_DEADLINE_RATIO()': '0x90fc26b1',
                        'WORKERPOOL_STAKE_RATIO()': '0x4ec3b9e3',
                        'KITTY_RATIO()': '0x51152de1',
                        'KITTY_MIN()': '0xe2e7a8c1',
                        'KITTY_ADDRESS()': '0x9e986e81',
                        'GROUPMEMBER_PURPOSE()': '0x68a9ef1c',
                    }[fragment.split('function ')[1]] || '0x00000000',
            };
        }
    }

    await updateDiamondProxy({
        description: 'Remove automatic getters and add new IexecPocoAccessorsFacet',
        facetsToRemove: [
            {
                name: 'LegacyAccessorFunctions',
                factory: LegacyAccessorFacetFactory as any,
                selectorsToRemove: [
                    // Legacy accessor function signatures
                    '0x70a08231', // balanceOf()
                    '0x06fdde03', // name()
                    '0x95d89b41', // symbol()
                    '0x313ce567', // decimals()
                    '0x18160ddd', // totalSupply()
                    '0xdd62ed3e', // allowance()
                    '0x9910fd72', // workerpoolByIndex()
                    '0xdb8aaa26', // appByIndex()
                    '0x1bf6e00d', // datasetByIndex()
                    // Automatic getters from previous public constants
                    '0x7b244832', // CONTRIBUTION_DEADLINE_RATIO()
                    '0x5fde601d', // REVEAL_DEADLINE_RATIO()
                    '0x90fc26b1', // FINAL_DEADLINE_RATIO()
                    '0x4ec3b9e3', // WORKERPOOL_STAKE_RATIO()
                    '0x51152de1', // KITTY_RATIO()
                    '0xe2e7a8c1', // KITTY_MIN()
                    '0x9e986e81', // KITTY_ADDRESS()
                    '0x68a9ef1c', // GROUPMEMBER_PURPOSE()
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
    });

    console.log('\nOriginal script functionality completed using generic diamond update!');
    console.log('Key improvements:');
    console.log('  ✓ Completely generic - works with any facet combination');
    console.log('  ✓ Supports partial function removal (not just complete facets)');
    console.log('  ✓ Automatic conflict detection and resolution');
    console.log('  ✓ Comprehensive logging and error handling');
    console.log('  ✓ Reusable across all diamond update scenarios');
})();
