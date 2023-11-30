#!/usr/bin/env zx

// Usage: "npm run storage-to-diagrams" or "npx zx tools/storage-to-diagrams"
// Check sol2uml documentation at https://github.com/naddison36/sol2uml#storage-usage.


$.verbose = false // Disable bash commands logging.

const projectRootDir = await $`dirname ${__dirname}`
generateStorageDiagram('IexecPocoBoostDelegate')

/**
 * Generate storage diagram of a given contract.
 * @param contractName 
 */
async function generateStorageDiagram(contractName) {
    console.log(`Generating storage diagram for contract : ${contractName}`);
    await $`cd ${projectRootDir} && 
        npx sol2uml storage -c ${contractName} .`
}
