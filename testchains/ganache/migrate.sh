#!/usr/bin/env bash
nohup node /app/dist/node/cli.js --wallet.mnemonic "$MNEMONIC" --miner.blockGasLimit 8000000 --chain.networkId 65535 --chain.chainId 65535 --chain.hardfork london --database.dbPath "/ganachedb" > deployed.txt 2>&1 &
sleep 4
cd /iexec-poco && \
  bash -i -c "npm ci --production=false" && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  rm -R contracts && \
  rm -R build
