#!/usr/bin/env zx

// Usage: "npm run storage-to-diagrams" or "npx zx scripts/tools/storage-to-diagrams"
// Check sol2uml documentation at https://github.com/naddison36/sol2uml#storage-usage.


$.verbose = false // Disable bash commands logging.

// Get the project root directory (two levels up from scripts/tools/)
const projectRootDir = path.resolve(path.dirname(path.dirname(__dirname)))
console.log(`Project root directory: ${projectRootDir}`)

// Change to project root directory
process.chdir(projectRootDir)

await generateStorageDiagram('IexecPocoBoostFacet')

/**
 * Generate storage diagram of a given contract.
 * @param contractName
 */
async function generateStorageDiagram(contractName) {
    console.log(`Generating storage diagram for contract : ${contractName}`);
    await $`npx sol2uml storage -c ${contractName} -o docs/uml/storage-${contractName}.svg .`
}
