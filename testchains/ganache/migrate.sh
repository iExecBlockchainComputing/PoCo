#!/usr/bin/env bash
echo "========== STARTING BLOCKCHAIN ==========";
nohup node /app/dist/node/cli.js --wallet.mnemonic "$MNEMONIC" --chain.networkId 65535 --chain.chainId 65535 --chain.hardfork berlin --database.dbPath "/ganachedb" > deployed.txt 2>&1 &
sleep 4

cd /iexec-poco && \
  echo "========== INSTALL DEPENDENCIES ==========" && \
  bash -i -c "npm ci --production=false" && \
  echo "========== STANDARD DEPLOYMENT ==========" && \
  jq . config/config.json && \
  bash -i -c "./node_modules/.bin/truffle migrate" && \
  echo "========== CLEANUP ==========" && \
  rm -R build && \
  rm -R contracts && \
  echo "========== DONE ==========";
