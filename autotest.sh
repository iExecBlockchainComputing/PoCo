#!/usr/bin/bash

trap catch INT

GANACHE="node_modules/.bin/ganache-cli -m \"actual surround disorder swim upgrade devote digital misery truly verb slide final\" -l 8000000 -i 1544020727674"
TRUFFLE="./node_modules/.bin/truffle"

function print_style
{
	if   [ "$1" == "info"    ]; then COLOR="96m";
	elif [ "$1" == "success" ]; then COLOR="92m";
	elif [ "$1" == "warning" ]; then COLOR="93m";
	elif [ "$1" == "danger"  ]; then COLOR="91m";
	else                             COLOR="0m";
	fi
	STARTCOLOR="\e[$COLOR";
	ENDCOLOR="\e[0m";
	printf "$STARTCOLOR%b$ENDCOLOR" "$2";
}

function initialize
{
	mkdir -p logs
	# starting ganache
	print_style 'info' "Starting ganache daemon in a tmux session\n"
	tmux new-session -s ganache -d script -f logs/ganache.$date.log -c "$GANACHE" || exit 1
}
function finalize
{
	# stopping ganache
	print_style 'info' "Stoping ganache daemon\n"
	tmux kill-session -t ganache || exit 1
	rm -f logs/ganache.$date.log
}

function catch
{
	print_style 'warning' "\n*** Killing test suite ***\n"
	finalize
	exit 1
}

function runCompile
{
	# compile contracts
	logfile="logs/compile.$date.log"
	printf "Compiling ... "
	$TRUFFLE compile > $logfile 2>&1
	if [[ $? -ne 0 ]];
	then
		print_style 'danger' "failure\n"
		print_style 'danger' "Full report is available at $logfile\n"
		catch
	else
		print_style 'success' "success\n"
		rm -f $logfile
	fi
}

function runDeploy
{
	# try deploying contracts
	logfile="logs/deploy.$date.log"
	printf "Deploying ... "
	$TRUFFLE deploy > $logfile 2>&1
	if [[ $? -ne 0 ]];
	then
		print_style 'danger' "failure\n"
		print_style 'danger' "Full report is available at $logfile\n"
		catch
	else
		print_style 'success' "success\n"
		rm -f $logfile
	fi
}

function runTests
{
	# running tests
	for filepath in `find test/ -type f -name "*.js" -print | sort`
	do
		filename=$(basename $filepath)
		logfile="logs/${filename%.*}.$date.log"

		if [ "$checkpoint" \> "$filename" ]; then continue; fi

		printf "Starting test ${filepath%.*} ... "
		$TRUFFLE test $filepath > $logfile 2>&1
		if [[ $? -ne 0 ]];
		then
			print_style 'danger' "failure\n"
			print_style 'danger' "Full report is available at $logfile\n"
			catch
		else
			print_style 'success' "success\n"
			rm -f $logfile
		fi
	done
}

date=$(date --utc +"%Y-%m-%dT%H:%M:%S")
checkpoint="$1"

# MAIN
initialize
runCompile
runDeploy
runTests
finalize
