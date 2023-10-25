// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { findAll } = require('solidity-ast/utils');
const { astDereferencer } = require('solidity-ast/utils');
const { solcInputOutputDecoder } = require('@openzeppelin/upgrades-core/dist/src-decoder');
const { extractStorageLayout } = require('@openzeppelin/upgrades-core/dist/storage/extract');
const { getStorageUpgradeReport } = require('@openzeppelin/upgrades-core/dist/storage');

const layouts = {};

const build = 'artifacts/build-info';
for (const artifact of fs.readdirSync(build)) {
    const { solcVersion, input, output } = JSON.parse(fs.readFileSync(path.join(build, artifact)));
    const decoder = solcInputOutputDecoder(input, output);
    const deref = astDereferencer(output);

    for (const src in output.contracts) {
        // Skip if no AST
        if (!output.sources[src].ast) continue;
        for (const contractDef of findAll('ContractDefinition', output.sources[src].ast)) {
            // Skip libraries and interfaces that don't have storage anyway
            if (['library', 'interface'].includes(contractDef.contractKind)) continue;
            // Store storage layout for this version of this contract
            layouts[contractDef.name] ??= {}
            layouts[contractDef.name][solcVersion] = extractStorageLayout(
                contractDef,
                decoder,
                deref,
                output.contracts[src][contractDef.name].storageLayout,
            );
        }
    }
}

for (const [ name, versions ] of Object.entries(layouts)) {
    const keys = Object.keys(versions).sort(semver.compare);
    switch (keys.length) {
        case 0: // should never happen
        case 1: // contract only available in one version
            continue;
        default:
            console.log(`[${name}]`);
            keys.slice(0,-1).forEach((v, i) => {
                const report = getStorageUpgradeReport(versions[v], versions[keys[i+1]], {});
                if (report.ok) {
                    console.log(`- ${v} → ${keys[i+1]}: storage layout is compatible`);
                } else {
                    console.log(report.explain());
                    process.exitCode = 1;
                }
            });
            break;
    }
}
