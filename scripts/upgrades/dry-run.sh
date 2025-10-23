#!/bin/bash
set -e

# Usage:
#   ARBITRUM_SEPOLIA_FORK=true \
#   UPGRADE_SCRIPT=<script_name> \
#       bash ./scripts/upgrades/dry-run.sh


DEPLOYMENTS_FOLDER=''
if [ "${ARBITRUM_SEPOLIA_FORK}" == "true" ]; then
    DEPLOYMENTS_FOLDER=arbitrumSepolia
elif [ "${ARBITRUM_FORK}" == "true" ]; then
    DEPLOYMENTS_FOLDER=arbitrum
fi
# Copy the forked network deployments to the hardhat network folder.
rm -rf deployments/hardhat
cp -r deployments/${DEPLOYMENTS_FOLDER} deployments/hardhat
# Stage the old deployments to have a clean diff after the upgrade script run.
cp .gitignore .gitignore.bak
sed -i '/deployments\/hardhat/d' .gitignore
git add deployments/hardhat
# Run the upgrade and print the git diff.
npx hardhat run scripts/upgrades/${UPGRADE_SCRIPT} --network hardhat
echo "=== Upgrade diff ==="
git --no-pager diff --name-status
mv .gitignore.bak .gitignore
