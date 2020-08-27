#!/bin/bash

expected='Copyright 2020 IEXEC BLOCKCHAIN TECH'
folders=(
	'contracts'
	'migrations'
	'scripts'
	'test'
	'utils'
)

for i in ${folders[@]};
do
	echo "# Checking copyrights in $i"
	git grep -L "$expected"	-- $i
done
