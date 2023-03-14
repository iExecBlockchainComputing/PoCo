#!/usr/bin/env bash

/nethermind/Nethermind.Runner --config=/nethermind/configs/poco-chain.cfg > /nethermind/chain.log 2>&1 &

# Wait for the chain to start 
sleep 5

# Install node packages and deploy PoCo's smart contracts
cd /iexec-poco && bash -i -c "./node_modules/.bin/truffle migrate"