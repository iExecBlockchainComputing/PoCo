#!/bin/bash


# TODO to be removed in the next PR.

# Fail when any command fails.
set -e

config_file=config/config.json

jq '.chains.default.asset = "Native"' $config_file > tmp.json && mv tmp.json $config_file

npm run test test/byContract/IexecEscrow/IexecEscrowNative.test.ts

jq '.chains.default.asset = "Token"' $config_file > tmp.json && mv tmp.json $config_file
