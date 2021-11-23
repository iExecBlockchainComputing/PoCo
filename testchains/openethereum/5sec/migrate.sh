#!/usr/bin/env bash
nohup /home/openethereum/openethereum --chain /iexec-poco/testchains/openethereum/5sec/spec.json --config /iexec-poco/testchains/openethereum/5sec/authority.toml -d /iexec-poco/testchains/openethereum/5sec/data > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm i --no-progress" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
