#!/bin/bash
set -e

# Usage:
#   ARBITRUM_SEPOLIA_FORK=true UPGRADE_SCRIPT=<script_name> bash ./scripts/upgrades/dry-run.sh
#   ARBITRUM_FORK=true UPGRADE_SCRIPT=<script_name> bash ./scripts/upgrades/dry-run.sh


DEPLOYMENTS_FOLDER=''
if [ "${ARBITRUM_SEPOLIA_FORK}" == "true" ]; then
    DEPLOYMENTS_FOLDER=arbitrumSepolia
elif [ "${ARBITRUM_FORK}" == "true" ]; then
    DEPLOYMENTS_FOLDER=arbitrum
fi

rm -rf deployments/hardhat
cp -r deployments/${DEPLOYMENTS_FOLDER} deployments/hardhat
cp .gitignore .gitignore.bak
sed -i '/deployments\/hardhat/d' .gitignore
git add deployments/hardhat
npx hardhat run scripts/upgrades/${UPGRADE_SCRIPT} --network hardhat
# Print the changes made during the dry run
git --no-pager diff --name-status
mv .gitignore.bak .gitignore
