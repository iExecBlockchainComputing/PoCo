// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const deployer = require('../scripts/hardhat-truffle-utils');
// CONFIG
const CONFIG = require('../config/config.json');
// Token
var RLC = artifacts.require('rlc-faucet-contract/RLC');
var ERLCTokenSwap = artifacts.require('@iexec/erlc/ERLCTokenSwap');

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function (accounts) {
    console.log('# web3 version:', web3.version);
    const chainid = await web3.eth.net.getId();
    const chaintype = await web3.eth.net.getNetworkType();
    console.log('Chainid is:', chainid);
    console.log('Chaintype is:', chaintype);
    console.log('Deployer is:', accounts[0]);

    const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;
    deploymentOptions.v5.usekyc = !!process.env.KYC;

    switch (deploymentOptions.asset) {
        case 'Token':
            if (deploymentOptions.token) {
                RLC.setAsDeployed(await RLC.at(deploymentOptions.token));
            } else {
                RLC.isDeployed() || (await deployer.deploy(RLC));
            }
            if (deploymentOptions.v5.usekyc) {
                if (deploymentOptions.etoken) {
                    ERLCTokenSwap.address = deploymentOptions.etoken;
                } else {
                    ERLCTokenSwap.isDeployed() ||
                        (await deployer.deploy(
                            ERLCTokenSwap,
                            (await RLC.deployed()).address,
                            'iExec ERLC Token',
                            'ERLC',
                            0,
                            [accounts[0]],
                            [],
                        ));
                }
            }
            break;

        case 'Native':
            if (deploymentOptions.v5.usekyc) {
                throw 'ERROR: KYC is not supported in native mode.';
            }
            break;
    }
};
