#!/bin/bash

trap catch INT

GANACHE="./node_modules/.bin/ganache-cli"
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
	nohup $GANACHE >> logs/ganache.$date.log 2>&1&
	GANACHE_PID=$!
	print_style 'info' "Started ganache daemon (pid=$GANACHE_PID)\n"
}

function finalize
{
	# stopping ganache
	rm -f logs/ganache.$date.log
	kill -9 $GANACHE_PID
	print_style 'info' "Killed ganache daemon (pid=$GANACHE_PID)\n"
}

function catch
{
	print_style 'warning' "\n*** Killing test suite ***\n"
	if [[ $LAUNCH -ne 0 ]]; then finalize; fi
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

function runMigrate
{
	# try migrating contracts
	logfile="logs/migrate.$date.log"
	printf "Migrating ... "
	$TRUFFLE migrate $PARAMS > $logfile 2>&1
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
	if [[ $FAST -ne 0 ]];
	then
		logfile="logs/fast.$date.log"
		printf "Running tests ... "
		$TRUFFLE test $PARAMS 2>&1 | tee $logfile
		if [[ $? -ne 0 ]];
		then
			print_style 'danger' "failure\n"
			catch
		else
			print_style 'success' "success\n"
			# rm -f $logfile
		fi
	else
		for filepath in `find test/ -type f -name "*.js" -print | sort`
		do
			filename=$(basename $filepath)
			logfile="logs/${filename%.*}.$date.log"
			if [ "$CHECKPOINT" \> "$filename" ]; then continue; fi
			printf "Starting test ${filepath%.*} ... "
			$TRUFFLE test $filepath $PARAMS > $logfile 2>&1
			if [[ $? -ne 0 ]];
			then
				print_style 'danger' "failure\n"
				print_style 'danger' "Full report is available at $logfile\n"
				catch
			else
				print_style 'success' "success\n"
				# rm -f $logfile
			fi
		done
	fi
}

date=$(date --utc +"%Y-%m-%dT%H:%M:%S")

FAST=0
LAUNCH=1
COMPILE=1
DEPLOY=1
CHECKPOINT=""
PARAMS=""

while test $# -gt 0; do
	case $1 in
		fast)
			FAST=1
			;;
		skip-launch)
			LAUNCH=0
			;;
		skip-compile)
			COMPILE=0
			;;
		skip-deploy)
			DEPLOY=0
			;;
		checkpoint)
			CHECKPOINT=$2
			shift
			;;
		*)
			PARAMS="$PARAMS $1"
			;;
	esac
	shift
done

# MAIN
if [[ $LAUNCH  -ne 0 ]]; then initialize; fi
if [[ $COMPILE -ne 0 ]]; then runCompile; fi
if [[ $DEPLOY  -ne 0 ]]; then runMigrate; fi
runTests
if [[ $LAUNCH  -ne 0 ]]; then finalize;   fi
