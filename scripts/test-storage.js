const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { findAll } = require('solidity-ast/utils');
const { astDereferencer } = require('@openzeppelin/upgrades-core/dist/ast-dereferencer');
const { solcInputOutputDecoder } = require('@openzeppelin/upgrades-core/dist/src-decoder');
const { extractStorageLayout } = require('@openzeppelin/upgrades-core/dist/storage/extract');
const { getStorageUpgradeReport } = require('@openzeppelin/upgrades-core/dist/storage');

const names = ['Store'];
const layouts = Object.fromEntries(names.map(name => [ name, {} ]));

const build = 'artifacts/build-info';
for (const artifact of fs.readdirSync(build)) {
    const { solcVersion, input, output } = JSON.parse(fs.readFileSync(path.join(build, artifact)));
    const decoder = solcInputOutputDecoder(input, output);
    const deref = astDereferencer(output);

    for (const src in output.contracts) {
        // Skip if no AST
        if (!output.sources[src].ast) continue;
        for (const contractDef of findAll('ContractDefinition', output.sources[src].ast)) {
            if (names.includes(contractDef.name)) {
                layouts[contractDef.name][solcVersion] = extractStorageLayout(
                    contractDef,
                    decoder,
                    deref,
                    output.contracts[src][contractDef.name].storageLayout,
                );
            }
        }
    }
}

for (const name of names) {
    // from old to new
    const versions = Object.keys(layouts[name]).sort(semver.compare);

    if (versions.length != 2) {
        console.error(`Need 2 version of ${name} for storage comparison. ${versions.length} found`);
        process.exitCode = 1;
        continue;
    }

    const report = getStorageUpgradeReport(...versions.map(v => layouts[name][v]), {});
    if (report.ok) {
        console.log(`[${name}] storage layout is compatible`);
    } else {
        console.log(report.explain());
        process.exitCode = 1;
    }
}
