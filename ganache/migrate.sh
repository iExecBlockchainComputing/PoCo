#!/usr/bin/env bash
nohup node /app/ganache-core.docker.cli.js -m "$MNEMONIC" -l 8000000 -i 65535 --hardfork istanbul --db "/ganachedb" > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  bash -i -c "npm i" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
