#!/bin/bash

sub_dir=""

logs_dir="logs/$sub_dir"
mkdir -p $logs_dir
exit_code=0
if [[ $OSTYPE == 'darwin'* ]]; then
  files=$(find test/ -type f | sort)
else 
    files=$(find test/ -regex '.*\(js\|ts\)' | sort)
fi
for f in $files; do
    log_file=$logs_dir$(basename "$f").logs
    echo "Running $sub_dir: $f ($log_file)"
    npx hardhat test "$f" &>"$log_file" # redirect stdout and stderr
    # display summary (filter with passing/failing and only show failing)
    failing_line=$(grep -A 2 'passing (' "$log_file" |
        grep 'failing')
    if [ -n "$failing_line" ]; then
        exit_code=1
        echo "$failing_line"
    fi
done

exit $exit_code
