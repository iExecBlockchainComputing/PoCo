#!/usr/bin/env bash
nohup /bin/parity --chain /iexec-poco/parity/spec.json --config /iexec-poco/parity/authority.toml -d /iexec-poco/parity/data --geth > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm i" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
