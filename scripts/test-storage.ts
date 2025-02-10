// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { solcInputOutputDecoder } from '@openzeppelin/upgrades-core/dist/src-decoder';
import { getStorageUpgradeReport } from '@openzeppelin/upgrades-core/dist/storage';
import { extractStorageLayout } from '@openzeppelin/upgrades-core/dist/storage/extract';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { astDereferencer, findAll } from 'solidity-ast/utils';

interface ContractLayouts {
    [contractName: string]: {
        [version: string]: any;
    };
}

/**
 * Checks storage layout compatibility between different versions of contracts
 * @returns true if all storage layouts are compatible, false otherwise
 */
export function checkStorageLayoutCompatibility(): boolean {
    const layouts: ContractLayouts = {};
    const buildDir = 'artifacts/build-info';

    // Read and process all build artifacts
    for (const artifact of fs.readdirSync(buildDir)) {
        const buildInfo = JSON.parse(fs.readFileSync(path.join(buildDir, artifact), 'utf8'));
        const { solcVersion, input, output } = buildInfo;
        const decoder = solcInputOutputDecoder(input, output);
        const deref = astDereferencer(output);

        // Process each contract in the build output
        for (const src in output.contracts) {
            // Skip if no AST
            if (!output.sources[src].ast) continue;

            // Process each contract definition
            for (const contractDef of findAll('ContractDefinition', output.sources[src].ast)) {
                // Skip libraries and interfaces that don't have storage
                if (['library', 'interface'].includes(contractDef.contractKind)) continue;

                // Initialize storage layout for this contract if not exists
                layouts[contractDef.name] = layouts[contractDef.name] || {};

                // Store storage layout for this version
                layouts[contractDef.name][solcVersion] = extractStorageLayout(
                    contractDef,
                    decoder,
                    deref,
                    output.contracts[src][contractDef.name].storageLayout,
                );
            }
        }
    }

    let hasIncompatibleLayouts = false;

    // Check compatibility between versions
    for (const [name, versions] of Object.entries(layouts)) {
        const keys = Object.keys(versions).sort(semver.compare);
        switch (keys.length) {
            case 0: // should never happen
            case 1: // contract only available in one version
                continue;
            default:
                console.log(`[${name}]`);
                keys.slice(0, -1).forEach((v, i) => {
                    const validationOptions = {
                        unsafeAllowRenames: true,
                        unsafeSkipStorageCheck: true,
                        unsafeAllowCustomTypes: true,
                        unsafeAllowLinkedLibraries: true,
                        unsafeAllow: [],
                        kind: 'transparent' as const,
                    };
                    const report = getStorageUpgradeReport(
                        versions[v],
                        versions[keys[i + 1]],
                        validationOptions,
                    );
                    if (report.ok) {
                        console.log(`- ${v} → ${keys[i + 1]}: storage layout is compatible`);
                    } else {
                        console.log(report.explain());
                        hasIncompatibleLayouts = true;
                    }
                });
                break;
        }
    }

    return !hasIncompatibleLayouts;
}

// Run the check if this file is being run directly
if (require.main === module) {
    const success = checkStorageLayoutCompatibility();
    process.exit(success ? 0 : 1);
}
