// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { IexecPocoAccessorsFacet__factory } from '../../../typechain';
import { updateDiamondProxy } from './generic-diamond-update';

/**
 * Example: Simple diamond update using the generic function
 * This shows the cleanest way to use the new generic script
 */
(async () => {
    await updateDiamondProxy({
        description: 'Remove old accessor functions and add new IexecPocoAccessorsFacet',

        // Remove specific function selectors (you provide the exact selectors to remove)
        facetsToRemove: [
            {
                name: 'SpecificLegacyFunctions',
                factory: null, // Not needed when providing specific selectors
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

        // Add new facet using factory class
        facetsToAdd: [
            {
                deploymentName: 'IexecPocoAccessorsFacet',
                factory: IexecPocoAccessorsFacet__factory,
                saveDeployment: true,
            },
        ],

        verbose: true,
    });

    console.log('\n✅ Diamond update completed successfully!');
})();
