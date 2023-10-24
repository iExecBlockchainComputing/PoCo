#!/bin/bash

copyrightRegex='Copyright 202[0-9] IEXEC BLOCKCHAIN TECH'

folders=(
	'contracts'
	'migrations'
	'scripts'
	'test'
	'utils'
)

for folder in ${folders[@]}; do
	echo "# Checking copyrights in $folder"
    grep --recursive --files-without-match --regexp "${copyrightRegex}" ${folder} | sort
done
