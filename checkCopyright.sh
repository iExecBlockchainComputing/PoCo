#!/bin/bash

expected_2020='Copyright 2020 IEXEC BLOCKCHAIN TECH'
expected_2023='Copyright 2023 IEXEC BLOCKCHAIN TECH'

folders=(
	'contracts'
	'migrations'
	'scripts'
	'test'
	'utils'
)

for folder in ${folders[@]}; do
	echo "# Checking copyrights in $folder"
	files=$(find $folder -type f)
	
	for file in $files; do
		if !(grep -q "$expected_2020" "$file") && !(grep -q "$expected_2023" "$file") ; then
			echo "$file"
		fi

	done
done


