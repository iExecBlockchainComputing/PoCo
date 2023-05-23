#!/bin/bash

ROOT=$(pwd $(dirname $0))
SOL2UML="$ROOT/node_modules/sol2uml/lib/sol2uml.js"

generate_class_uml() {
    contracts_to_display=$1
    cd $ROOT/contracts/
    output_filename="${contracts_to_display/\//-}" # convert slash to dash of needed
    $SOL2UML class $contracts_to_display/ -o "$ROOT/uml/class-uml-$output_filename.svg"
}

generate_class_uml libs
generate_class_uml modules
generate_class_uml registries
