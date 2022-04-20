#!/usr/bin/env bash

# Start the chain in the background
nohup /home/openethereum/openethereum \
        --chain /iexec-poco/testchains/openethereum/spec.json \
        --config /iexec-poco/testchains/openethereum/authority.toml \
        -d /iexec-poco/testchains/openethereum/chain-data > deployed.txt 2>&1 &

# Wait for the chain to start 
sleep 4

# Install node packages and deploy PoCo's smart contracts
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm i --no-progress" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
