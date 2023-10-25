#!/usr/bin/env zx

// Usage: "npm run sol-to-uml" or "npx zx tools/solidity-to-uml.mjs"
// For sol2uml documentation, see https://github.com/naddison36/sol2uml#usage


$.verbose = false // Disable bash commands logging.

const rootDir = await $`dirname ${__dirname}`

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
        'IexecEscrowTokenDelegateKYC',
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
    const filename = directory.replace('/', '-');
    await $`npx sol2uml class contracts/${directory}/ -o ${rootDir}/uml/class-uml-dir-${filename}.svg`
}

/**
 * Generate class UML only connected to set of given contracts
 * @param contractsList 
 * @param filename Output file name.
 */
async function generateClassDiagramOfContracts(contractsList, filename) {
    console.log(`Generating class diagram for contracts : ${contractsList}`);
    const baseContracts = contractsList.join(','); // => c1,c2,c3
    // -b, --baseContractNames <value> 
    // only output contracts connected to these comma separated base contract names
    await $`npx sol2uml class contracts/ -b ${baseContracts} -o ${rootDir}/uml/class-uml-${filename}.svg`
}
