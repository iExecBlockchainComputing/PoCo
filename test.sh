#!/bin/bash

if [ -z "$KYC" ]; then
    sub_dir=""
else
    sub_dir="kyc/"
fi

logs_dir="logs/$sub_dir"
mkdir -p $logs_dir
exit_code=0
for f in $(find test/ -name '*.js' | sort); do
    log_file=$logs_dir$(basename "$f").logs
    echo "Running $sub_dir: $f ($log_file)"
    npx hardhat test "$f" >"$log_file" 2>&1 # redirect stdout and stderr
    # display summary (filter with passing/failing and only show failing)
    failing_line=$(grep -A 2 'passing (' "$log_file" |
        grep 'failing')
    if [ -n "$failing_line" ]; then
        exit_code=1
        echo "$failing_line"
    fi
done

exit $exit_code
