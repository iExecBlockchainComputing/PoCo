#!/bin/bash

cd $(dirname $0)

for file in ../deployments/arbitrumSepolia/*; do  
    address=$(jq -r .address $file); 
    echo $(basename $file):$address
    ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY} npx hardhat verify --network arbitrumSepolia $address
done