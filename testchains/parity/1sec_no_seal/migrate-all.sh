#!/usr/bin/env bash
echo "========== STARTING BLOCKCHAIN ==========";
nohup /bin/parity --chain /iexec-poco/testchains/parity/1sec_no_seal/spec.json --config /iexec-poco/testchains/parity/1sec_no_seal/authority.toml -d /iexec-poco/testchains/parity/1sec_no_seal/data --geth > deployed.txt 2>&1 &
sleep 4

cd /iexec-poco && \
  echo "========== INSTALL DEPENDENCIES ==========" && \
  bash -i -c "npm i" && \
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
