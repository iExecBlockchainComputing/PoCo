#!/usr/bin/env bash
nohup /home/openethereum/openethereum --chain /iexec-poco/testchains/openethereum/20sec/spec.json --config /iexec-poco/testchains/openethereum/20sec/authority.toml --force-sealing -d /iexec-poco/testchains/openethereum/20sec/data > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  sed -i '/ethereumjs-util/d' package.json && \
  bash -i -c "npm i --no-progress" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
