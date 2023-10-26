#!/usr/bin/env zx

// Usage: "npm run storage-to-diagrams" or "npx zx tools/storage-to-diagrams"
// Check sol2uml documentation at https://github.com/naddison36/sol2uml#storage-usage.


// $.verbose = false // Disable bash commands logging.

const projectRootDir = await $`dirname ${__dirname}`
// generateStorageDiagram('IexecPocoBoostDelegate', 'IexecPocoClassic')
generateStorageDiagram('IexecPocoBoostDelegate', 'IexecPocoBoost')

/**
 * Generate storage diagram of a given contract.
 * @param contractName 
 * @param filename Output file name.
 */
async function generateStorageDiagram(contractName, filename) {
    console.log(`Generating storage diagram for contract : ${contractName}`);
    // await $`npx sol2uml storage -c ${contractName} -o ${projectRootDir}/uml/storage-${filename}.svg contracts/`
    await $`npx sol2uml storage contracts/ -c Store`
}
