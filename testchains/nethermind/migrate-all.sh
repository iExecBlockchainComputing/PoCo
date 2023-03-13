#!/usr/bin/env bash
echo "========== STARTING BLOCKCHAIN =========="

/nethermind/Nethermind.Runner --config=/nethermind/configs/poco-chain.cfg > /nethermind/chain.log 2>&1 &

# Wait for the chain to start 
sleep 5

# Install node packages and deploy PoCo's smart contracts
cd /iexec-poco && \
  echo "========== INSTALL DEPENDENCIES ==========" && \
  bash -i -c "npm ci --production=false" && \
  echo "========== STANDARD DEPLOYMENT ==========" && \
  jq . config/config.json && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  echo "========== SET RLC IN CONFIG ==========" && \
  echo $(jq ". | .chains.default.token = $(jq '.networks."65535".address' build/contracts/RLC.json)" config/config.json) > config/config.json && \
  rm -R build && \
  echo "========== ENTERPRISE DEPLOYMENT ==========" && \
  jq . config/config.json && \
  bash -i -c "KYC=1 PROXY_SALT=0x0000000000000000000000000000000000000000000000000000000000000001 ./node_modules/.bin/truffle migrate" && \
  rm -R build && \
  echo "========== CLEANUP ==========" && \
  rm -R contracts && \
  echo "========== DONE ==========";
