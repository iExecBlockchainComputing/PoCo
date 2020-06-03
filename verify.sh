#!/usr/bin/env bash

NETWORKS=(
	# mainnet
	# ropsten
	rinkeby
	# goerli
	# kovan
)

declare -A CHAINID=(
	[mainnet]=1
	[ropsten]=3
	[rinkeby]=4
	[goerli]=5
	[kovan]=42
)

CONTRACTS=(
	# AppRegistry
	# DatasetRegistry
	# WorkerpoolRegistry
	# ENSIntegrationDelegate
	# IexecCategoryManagerDelegate
	# IexecERC20Delegate
	# IexecEscrowTokenDelegate
	# IexecMaintenanceExtraDelegate
	# IexecRelayDelegate

	# IexecAccessorsABILegacyDelegate
	# IexecMaintenanceDelegate # Library ?
	# IexecPocoDelegate # Library ?
	# IexecOrderManagementDelegate # Library ?
	# IexecLibOrders_v5 # ???
)

for CONTRACT in "${CONTRACTS[@]}";
do
for NETWORK in "${NETWORKS[@]}";
do
	truffle run verify $CONTRACT --network $NETWORK $@
done
done
