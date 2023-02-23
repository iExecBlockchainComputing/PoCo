
#!/usr/bin/env bash
echo "========== STARTING BLOCKCHAIN =========="


BASE_DIR="/iexec-poco/testchains/nethermind"

echo $${VALIDATOR_ADDRESS} | awk '{print tolower($$0)}' | xargs -I {address} 
./Nethermind.Runner --config ${BASE_DIR}/authority.cfg &
sleep 4

cd /iexec-poco && \
  echo "========== INSTALL DEPENDENCIES ==========" && \
  bash -i -c "npm ci --production=false" && \
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
