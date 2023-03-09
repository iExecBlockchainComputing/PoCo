#!/usr/bin/env bash

./Nethermind.Runner \
    --config=${BASE_DIR}/authority.cfg \
    -d /iexec-poco/testchains/nethermind/chain-data > deployed.txt 2>&1 &

# Wait for the chain to start 
sleep 4

# Install node packages and deploy PoCo's smart contracts
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm ci --production=false" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
