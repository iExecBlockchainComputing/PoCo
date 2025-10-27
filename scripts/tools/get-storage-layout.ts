// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { solcInputOutputDecoder } from '@openzeppelin/upgrades-core/dist/src-decoder';
import { extractStorageLayout } from '@openzeppelin/upgrades-core/dist/storage/extract';
import fs from 'fs';
import path from 'path';
import { astDereferencer, findAll } from 'solidity-ast/utils';

interface StorageVariable {
    label: string;
    offset: number;
    slot: string;
    type: string;
    contract: string;
}

/**
 * Extracts storage layout information for all PoCo contracts
 * This is needed to intelligently reset contract state
 */
export function getPocoStorageLayout(): Map<string, StorageVariable[]> {
    const layouts = new Map<string, StorageVariable[]>();
    const buildDir = 'artifacts/build-info';

    console.log('📚 Extracting storage layouts from build artifacts...\n');

    // Read all build artifacts
    for (const artifact of fs.readdirSync(buildDir)) {
        const buildInfo = JSON.parse(fs.readFileSync(path.join(buildDir, artifact), 'utf8'));
        const { input, output } = buildInfo;
        const decoder = solcInputOutputDecoder(input, output);
        const deref = astDereferencer(output);

        // Process each source file
        for (const src in output.contracts) {
            if (!output.sources[src]?.ast) continue;

            // Process each contract definition
            for (const contractDef of findAll('ContractDefinition', output.sources[src].ast)) {
                // Skip libraries and interfaces
                if (['library', 'interface'].includes(contractDef.contractKind)) continue;

                try {
                    const layout = extractStorageLayout(
                        contractDef,
                        decoder,
                        deref,
                        output.contracts[src][contractDef.name].storageLayout,
                    );

                    // Convert to our format
                    const variables: StorageVariable[] = layout.storage.map((item: any) => ({
                        label: item.label,
                        offset: item.offset,
                        slot: item.slot,
                        type: item.type,
                        contract: contractDef.name,
                    }));

                    if (variables.length > 0) {
                        layouts.set(contractDef.name, variables);
                        console.log(`  ${contractDef.name}: ${variables.length} storage variables`);
                    }
                } catch (error) {
                    // Skip contracts without storage layout
                }
            }
        }
    }

    console.log(`\n✅ Extracted layouts from ${layouts.size} contracts\n`);
    return layouts;
}

/**
 * Get specific storage variables to reset for PoCo contracts
 */
export function getStorageVariablesToReset(): {
    contract: string;
    variables: string[];
}[] {
    return [
        {
            contract: 'IexecEscrowStorage',
            variables: [
                'm_totalSupply', // Reset total supply
                // Note: m_balances and m_frozens are mappings - handled separately
            ],
        },
        {
            contract: 'IexecPocoStorage',
            variables: [
                // Deal and task counters, etc.
            ],
        },
    ];
}

/**
 * Print storage layout for debugging
 */
export function printStorageLayout(contractName?: string) {
    const layouts = getPocoStorageLayout();

    if (contractName) {
        const layout = layouts.get(contractName);
        if (layout) {
            console.log(`\n📋 Storage layout for ${contractName}:`);
            console.log('-'.repeat(80));
            layout.forEach((v) => {
                console.log(`  Slot ${v.slot.padStart(3)}: ${v.label.padEnd(30)} (${v.type})`);
            });
        } else {
            console.log(`❌ Contract ${contractName} not found`);
        }
    } else {
        console.log('\n📋 All contract storage layouts:');
        console.log('='.repeat(80));
        for (const [name, vars] of layouts.entries()) {
            console.log(`\n${name}:`);
            vars.forEach((v) => {
                console.log(`  Slot ${v.slot.padStart(3)}: ${v.label.padEnd(30)} (${v.type})`);
            });
        }
    }
}

// Run if called directly
if (require.main === module) {
    const contractName = process.argv[2];
    printStorageLayout(contractName);
}
