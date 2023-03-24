#!/usr/bin/env bash

echo "### Starting chain"
/nethermind/Nethermind.Runner --config poco-chain.cfg &> /nethermind/chain.log &

# Wait for the chain to start 
sleep 5

# Install node packages and deploy PoCo's smart contracts
echo "### Running migration"
cd /iexec-poco && bash -i -c "./node_modules/.bin/truffle migrate"
