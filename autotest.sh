#!/usr/bin/bash

BINPATH="node_modules/.bin"
TRUFFLE="$BINPATH/truffle"
TESTRPC="$BINPATH/testrpc"

trap catch INT

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
	# starting testrpc
	print_style 'info' "Starting testrpc daemon in a tmux session\n"
	tmux new-session -s testrpc -d script -f logs/testrpc.$date.log -c $TESTRPC || exit 1
}
function finalize
{
	# stopping testrpc
	print_style 'info' "Stoping testrpc daemon\n"
	tmux kill-session -t testrpc || exit 1
	rm -f logs/testrpc.$date.log
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

function runCoreTests
{
	# running tests
	for filepath in `find test/ -maxdepth 1 -type f -name "*.js" -print | sort`
	do
		filename=$(basename $filepath)
		logfile="logs/${filename%.*}.$date.log"

		if [ "$checkpoint" \> "$filename" ]; then continue; fi

		printf "Starting test ${filename%.*} ... "
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

function runAllTests
{
  # running tests
  logfile="logs/alltests.$date.log"
  printf "Starting all test ... "
  $TRUFFLE test > $logfile 2>&1
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

date=$(date --utc +"%Y-%m-%dT%H:%M:%S")
checkpoint="$1"

# MAIN
initialize
runCompile
runDeploy
runCoreTests
#runAllTests
finalize
