// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const deployer = require('../scripts/hardhat-truffle-utils');
// CONFIG
const CONFIG = require('../config/config.json');
// Token
var RLC = artifacts.require('rlc-faucet-contract/RLC');

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

    switch (deploymentOptions.asset) {
        case 'Token':
            if (deploymentOptions.token) {
                RLC.setAsDeployed(await RLC.at(deploymentOptions.token));
            } else {
                RLC.isDeployed() || (await deployer.deploy(RLC));
            }
            break;

        case 'Native':
            break;
    }
};
