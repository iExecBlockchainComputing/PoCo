#!/usr/bin/bash

date=$(date --utc +"%Y-%m-%dT%H:%M:%S")

# starting testrpc
tmux new-session -s testrpc -d script -f /tmp/testrpc.$date.log -c testrpc || exit 1

# compile contracts
logcompile="log/compile.$date.log"
printf "Compiling ... "
truffle compile > $logcompile 2>&1
if [[ $? -ne 0 ]];
then
	printf 'failure\n'
	printf 'Full report is available at %s\n' $logcompile
	break
else
	printf 'success\n'
fi

# try deploying contracts
logdeploy="log/deploy.$date.log"
printf "Deploying ... "
truffle deploy > $logdeploy 2>&1
if [[ $? -ne 0 ]];
then
	printf 'failure\n'
	printf 'Full report is available at %s\n' $logdeploy
	break
else
	printf 'success\n'
fi

# running tests
for filepath in `find test/ -maxdepth 1 -type f -name "*.js" -print | sort`
do
	filename=$(basename $filepath)
	logfile="log/${filename%.*}.$date.log"

	if [ "$1" \> "$filename" ]; then continue; fi

	printf "Starting test ${filename%.*} ... "
	truffle test $filepath > $logfile 2>&1
	if [[ $? -ne 0 ]];
	then
		printf 'failure\n'
		printf 'Full report is available at %s\n' $logfile
		break
	else
		printf 'success\n'
	fi
done

# stopping testrpc
tmux kill-session -t testrpc || exit 1
