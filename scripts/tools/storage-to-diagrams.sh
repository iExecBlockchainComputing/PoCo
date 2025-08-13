#!/usr/bin/env bash

# Usage: bash scripts/tools/storage-to-diagrams.sh
#
# Generate storage diagrams for the PoCo protocol using sol2uml.
# Check sol2uml documentation at https://github.com/naddison36/sol2uml#storage-usage.


npx hardhat flatten contracts/tools/diagrams/StorageDiagrams.sol > flatten.sol
npx sol2uml storage -c PocoStorageDiagram -o docs/uml/storage-diagram-poco.svg flatten.sol
npx sol2uml storage -c DiamondStorageDiagram -o docs/uml/storage-diagram-diamond.svg flatten.sol
rm -rf flatten.sol
