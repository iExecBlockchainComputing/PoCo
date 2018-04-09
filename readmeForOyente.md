This file introduce  the necessary steps for taking the oyente analysis of the melonproject, including the installation of the oyente (quote from the original instruction), you can find the link to the oyente in the link below:

https://github.com/melonproject/oyente

Full installation of oyente
Install the following dependencies
solc

```
$ sudo add-apt-repository ppa:ethereum/ethereum
$ sudo apt-get update
$ sudo apt-get install solc
```
evm from go-ethereum

    https://geth.ethereum.org/downloads/ or
    By from PPA if your using Ubuntu

```
$ sudo apt-get install software-properties-common
$ sudo add-apt-repository -y ppa:ethereum/ethereum
$ sudo apt-get update
$ sudo apt-get install ethereum
```
z3 Theorem Prover version 4.5.0.

Download the source code of version z3-4.5.0

Install z3 using Python bindings

```
$ python scripts/mk_make.py --python
$ cd build
$ make
$ sudo make install
```

Requests library

```
pip install requests
```

web3 library

```
pip install web3
```

Evaluating Ethereum Contracts

```
#evaluate a local solidity contract
python oyente.py -s <contract filename>

#evaluate a local solidity with option-a to verify assertions in the contract
python oyente.py -a -s <contract filename>

#evaluate a local evm contract
python oyente.py -s <contract filename> -b

#evaluate a remote contract
python oyente.py -ru https://gist.githubusercontent.com/loiluu/d0eb34d473e421df12b38c12a7423a61/raw/2415b3fb782f5d286777e0bcebc57812ce3786da/puzzle.sol
```


The contract filename should include the absolute path. Although the oyente can evaluate a contract online, yet it is impossible to evade the "import", and it is complicated to make the adjustion, so it is recommended to download the contract and analyze it locally. When the analysis is undertaken, it doesn't just analyze the contract you demande, but also all the contracts imported as well.

The outcome of the analysis include the following items: EVM Code Coverage, Integer Underflow, Integer Overflow, Parity Multisig Bug 2, Callstack Depth Attack Vulnerability, Transaction-Ordering Dependence (TOD), Timestamp Dependency, Re-Entrancy Vulnerability. All except the EVM Code Coverage are the performance of the contract in the analysis and give either true or false, a "false" stands for a good result, those lines of codes that arouse a "true" and the condition under which it gives a "true" would be given below.
the EVM Code Coverage is the criteria which tells the performance of the analysis, you can find its formula in the oyente as "evm_code_coverage = float(len(visited_pcs)) / len(instructions.keys()) * 100 " given it the form of percentage, it is the rate of the lines of the contract tested in the analysis. It is better to have a higher rate but even it is a lower rate, we can study why it happens, modify the contract and thus improve the performance of the contract.
