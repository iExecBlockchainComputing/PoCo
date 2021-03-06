#!/usr/bin/env bash
nohup /bin/parity --chain /iexec-poco/testchains/parity/1sec/spec.json --config /iexec-poco/testchains/parity/1sec/authority.toml -d /iexec-poco/testchains/parity/1sec/data --geth > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm i --no-progress" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
