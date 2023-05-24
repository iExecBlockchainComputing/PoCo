#!/bin/bash

ROOT=$(pwd "$(dirname "$0")")
SOL2UML="$ROOT/node_modules/sol2uml/lib/sol2uml.js"
cd "$ROOT/contracts/" || exit

# For sol2uml documentaiton, see https://github.com/naddison36/sol2uml#usage

# Generate class UML for contracts in a given directory
generate_class_uml_dir() {
    contracts_to_display=$1
    output_filename=${contracts_to_display/\//-} # convert slash to dash of needed
    $SOL2UML class "$contracts_to_display/" -o "$ROOT/uml/class-uml-dir-$output_filename.svg"
}

# Generate class UML only connected to set of given contracts
generate_class_uml_base() {
    base_contracts_to_display=$1
    output_filename=$2
    # -b, --baseContractNames <value> 
    # only output contracts connected to these comma separated base contract names
    $SOL2UML class . -b "$base_contracts_to_display" -o "$ROOT/uml/class-uml-$output_filename.svg"
}

generate_class_uml_dir libs
generate_class_uml_dir modules
generate_class_uml_dir registries

generate_class_uml_base \
    IexecPoco1Delegate,IexecPoco2Delegate \
    IexecPocoDelegates # out
generate_class_uml_base \
    IexecEscrowNativeDelegate,IexecEscrowTokenDelegateKYC,IexecEscrowTokenDelegate,IexecEscrowTokenSwapDelegate \
    IexecEscrows # out
    
