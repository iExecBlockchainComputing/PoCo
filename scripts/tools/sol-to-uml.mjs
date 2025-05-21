#!/usr/bin/env zx

// Usage: "npm run sol-to-uml" or "npx zx scripts/tools/solidity-to-uml.mjs"
// For sol2uml documentation, see https://github.com/naddison36/sol2uml#usage


$.verbose = false // Disable bash commands logging.

const projectRootDir = await $`dirname ${__dirname}`

await generateClassDiagramOfDirectory('libs')
await generateClassDiagramOfDirectory('modules')
await generateClassDiagramOfDirectory('registries')

await generateClassDiagramOfContracts(
    [
        'IexecPoco1Delegate',
        'IexecPoco2Delegate'
    ],
    'IexecPocoDelegates',
)

await generateClassDiagramOfContracts(
    [
        'IexecEscrowNativeDelegate',
        'IexecEscrowTokenDelegate',
        'IexecEscrowTokenSwapDelegate',
        'IexecEscrow',
    ],
    'IexecEscrows',
)

await generateClassDiagramOfContracts(
    ['IexecPocoBoostDelegate'],
    'IexecPocoBoostDelegate',
)

/**
 * Generate UML class diagrams for contracts in a given directory.
 * @param directory
 */
async function generateClassDiagramOfDirectory(directory) {
    console.log(`Generating class diagram for directory : ${directory}`);
    const diagramName = directory.replace('/', '-');
    await $`cd ${projectRootDir}/ &&
        npx sol2uml class contracts/${directory}/ -o docs/uml/class-uml-dir-${diagramName}.svg`
}

/**
 * Generate UML class diagrams for a set of given contracts.
 * @param contractsList
 * @param diagramName
 */
async function generateClassDiagramOfContracts(contractsList, diagramName) {
    console.log(`Generating class diagram for contracts : ${contractsList}`);
    const baseContracts = contractsList.join(','); // => c1,c2,c3
    // -b, --baseContractNames <name1,name2>
    // only output contracts connected to these comma separated base contract names
    await $`cd ${projectRootDir}/ &&
        npx sol2uml class contracts/ -b ${baseContracts} -o docs/uml/class-uml-${diagramName}.svg`
}
