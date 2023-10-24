#!/usr/bin/env zx

// Usage: npm run sol-to-uml
// For sol2uml documentaiton, see https://github.com/naddison36/sol2uml#usage

$.verbose = false // Disable bash commands logging.


const rootDir = await $`dirname ${__dirname}`

generateClassDiagramForDirectory('libs')
generateClassDiagramForDirectory('modules')
generateClassDiagramForDirectory('registries')

// generate_class_uml_base \
//     IexecPoco1Delegate,IexecPoco2Delegate \
//     IexecPocoDelegates # out
// generate_class_uml_base \
//     IexecEscrowNativeDelegate,IexecEscrowTokenDelegateKYC,IexecEscrowTokenDelegate,IexecEscrowTokenSwapDelegate \
//     IexecEscrows # out

/**
 * Generate UML class diagrams for contracts in a given directory.
 * @param dirName name of the target directory.
 */
async function generateClassDiagramForDirectory(dirName) {
    console.log(`Generating class diagram for directory : ${dirName}`);
    const filename = dirName.replace('/', '-');
    await $`npx sol2uml class contracts/${dirName}/ -o "${rootDir}/uml/class-uml-dir-${filename}.svg"`
}

// # Generate class UML only connected to set of given contracts
// generate_class_uml_base() {
//     base_contracts_to_display=$1
//     output_filename=$2
//     # -b, --baseContractNames <value> 
//     # only output contracts connected to these comma separated base contract names
//     $SOL2UML class . -b "$base_contracts_to_display" -o "$ROOT/uml/class-uml-$output_filename.svg"
// }
