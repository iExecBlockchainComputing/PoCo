#!/usr/bin/env bash

echo "### Starting chain"
/nethermind/Nethermind.Runner --config=/nethermind/configs/poco-chain.cfg &> /nethermind/chain.log &

# Wait for the chain to start 
sleep 5

# Install node packages and deploy PoCo's smart contracts
echo "### Running migration"
cd /iexec-poco && \
  echo "========== STANDARD DEPLOYMENT ==========" && \
  jq . config/config.json && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  echo "========== SET RLC IN CONFIG ==========" && \
  echo $(jq ". | .chains.default.token = $(jq '.networks."65535".address' build/contracts/RLC.json)" config/config.json) > config/config.json && \
  rm -R build && \
  echo "========== ENTERPRISE DEPLOYMENT ==========" && \
  jq . config/config.json && \
  bash -i -c "KYC=1 PROXY_SALT=0x0000000000000000000000000000000000000000000000000000000000000001 ./node_modules/.bin/truffle migrate"
