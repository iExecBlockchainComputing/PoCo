#!/usr/bin/env bash


BLOCK_CREATION_TIME=$1

echo "=> Starting chain with block creation time = ${BLOCK_CREATION_TIME}"

# replace block creation time in spec.json file
token=".engine.authorityRound.params.stepDuration=${BLOCK_CREATION_TIME}"
tmp=$(mktemp) && jq $token /parity/spec.json > "$tmp" && mv "$tmp" /parity/spec.json

cd /parity && nohup /bin/parity --config node.toml --geth > /dev/null 2>&1 &

sleep 4

cd /poco && \
    sed -i '/ethereumjs-util/d' package.json && \
    bash -i -c "npm i" && \
    bash -i -c "./node_modules/.bin/truffle migrate | tee /deploy.log"
    # rm -R contracts && \
    # rm -R build