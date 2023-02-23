#!/usr/bin/env bash



BASE_DIR="/iexec-poco/testchains/nethermind"

VALIDATOR_ADDRESS="0xc08c3def622af1476f2db0e3cc8ccaead07be3bb"
# NETHERMIND_KEYSTORECONFIG_BLOCKAUTHORACCOUNT="${VALIDATOR_ADDRESS}"
# NETHERMIND_KEYSTORECONFIG_UNLOCKACCOUNTS=["${VALIDATOR_ADDRESS}"]
# NETHERMIND_MININGCONFIG_MINGASPRICE=0
# NETHERMIND_KEYSTORECONFIG_PASSWORDFILES=${BASE_DIR}/keystore/validator-wallet-password
# NETHERMIND_INITCONFIG_ISMINING=true

echo $${VALIDATOR_ADDRESS} | awk '{print tolower($$0)}' | xargs -I {address} 
./Nethermind.Runner --config ${BASE_DIR}/authority.cfg &

# Wait for the chain to start 
sleep 4

# Install node packages and deploy PoCo's smart contracts
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm ci --production=false" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
