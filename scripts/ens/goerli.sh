#!/bin/bash

# Copyright 2020 IEXEC BLOCKCHAIN TECH
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

CMD="ethers-ens --network goerli --account $MNEMONIC --yes --wait"

function cprintf()
{
	span=$(((${2:-$(tput cols)} + ${#1}) / 2))
	printf "%${span}s\n" "$1"
}

function getAddr()
{
	grep Address <<< `$CMD lookup $1` | tr -s ' ' | cut -d' ' -f3
}

function setup()
{
	printf "┌──────────────────────────────────────────────────────────────────────────────┐\n"
	printf "│ %31s → %-42s │\n" $1 $2
	printf "└──────────────────────────────────────────────────────────────────────────────┘\n"

	lookup=`$CMD lookup $1`
	ctrl=`grep Controller <<< $lookup | tr -s ' ' | cut -d' ' -f3`
	rslv=`grep Resolver   <<< $lookup | tr -s ' ' | cut -d' ' -f3`
	addr=`grep Address    <<< $lookup | tr -s ' ' | cut -d' ' -f3`

	[[ -z "$ctrl"      ]] && echo "[set-subnode]"  && $CMD set-subnode  $1              # need to setup subdomain
	[[ -z "$2"         ]] && return                                                     # no addr → no need for a resolver
	[[ -z "$rslv"      ]] && echo "[set-resolver]" && $CMD set-resolver $1              # need to setup a resolver
	[[ "$2" != "$addr" ]] && echo "[set-addr]"     && $CMD set-addr     $1 --address $2 # wrong addr → need update
}

function reset()
{
	printf "┌──────────────────────────────────────────────────────────────────────────────┐\n"
	printf "│ %-76s │\n" "$(cprintf "Reset $1" 76)"
	printf "└──────────────────────────────────────────────────────────────────────────────┘\n"

	lookup=`$CMD lookup $1`
	ctrl=`grep Controller <<< $lookup | tr -s ' ' | cut -d' ' -f3`
	rslv=`grep Resolver   <<< $lookup | tr -s ' ' | cut -d' ' -f3`
	addr=`grep Address    <<< $lookup | tr -s ' ' | cut -d' ' -f3`

	[[ ! -z "$rslv" ]] && echo "[reset-resolver]" && $CMD set-resolver $1 --address 0x0000000000000000000000000000000000000000
	[[ ! -z "$ctrl" ]] && echo "[reset-subnode]"  && $CMD set-subnode  $1 --address 0x0000000000000000000000000000000000000000
}



# Check
$CMD lookup iexec.eth
$CMD lookup rlc.iexec.eth
$CMD lookup hub.v3.iexec.eth
$CMD lookup clerk.v3.iexec.eth
$CMD lookup apps.v3.iexec.eth
$CMD lookup datasets.v3.iexec.eth
$CMD lookup workerpools.v3.iexec.eth
$CMD lookup core.v5.iexec.eth
$CMD lookup apps.v5.iexec.eth
$CMD lookup datasets.v5.iexec.eth
$CMD lookup workerpools.v5.iexec.eth

# setup rlc.iexec.eth            0xe0d00540a3729B4fdB96f92534dA97DC7973Af8b

# Set new pointers
# setup v3.iexec.eth # subnode only
# setup hub.v3.iexec.eth         0x99d8717A84d1E97422d04d9a2a82694038470753
# setup clerk.v3.iexec.eth       0x56d07b25A3A21a6abeFdF777Aaa8F886ECfdB43a
# setup apps.v3.iexec.eth        0x221b9a91320a601b30992610425A960B1949B22d
# setup datasets.v3.iexec.eth    0x8Dc0a7d917aeF68E340DBF68eF4ECB36d1Ca941b
# setup workerpools.v3.iexec.eth 0xdAD30AAb14F569830bFd26EdF72df876dc30D20c
#
# setup v5.iexec.eth # subnode only
# setup core.v5.iexec.eth        0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f
# setup apps.v5.iexec.eth        0xB1C52075b276f87b1834919167312221d50c9D16
# setup datasets.v5.iexec.eth    0x799DAa22654128d0C64d5b79eac9283008158730
# setup workerpools.v5.iexec.eth 0xC76A18c78B7e530A165c5683CB1aB134E21938B4

# Reset old subdomains
# reset hub.iexec.eth
# reset clerk.iexec.eth
# reset apps.iexec.eth
# reset datasets.iexec.eth
# reset workerpools.iexec.eth
