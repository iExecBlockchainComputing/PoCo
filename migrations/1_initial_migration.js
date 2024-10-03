// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const deployer = require('../scripts/hardhat-truffle-utils');
var Migrations = artifacts.require('Migrations');

module.exports = async function () {
    await deployer.deploy(Migrations);
};
