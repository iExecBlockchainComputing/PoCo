// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre, { ethers } from 'hardhat';
import { TimelockController__factory } from '../typechain';
import { FactoryDeployerHelper } from '../utils/FactoryDeployerHelper';
const CONFIG = require('../config/config.json');

/**
 * Deploy TimelockController contract
 */
module.exports = async function () {
    console.log('Deploying TimelockController..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await hre.ethers.getSigners();
    const deploymentOptions = CONFIG.chains[chainId] || CONFIG.chains.default;
    const salt = process.env.SALT || deploymentOptions.v5.salt || ethers.constants.HashZero;

    // Initialize factory deployer
    const factoryDeployer = new FactoryDeployerHelper(owner, salt);

    // Deploy TimelockController
    const WEEK_IN_SECONDS = 86400 * 7; // 7 days
    const PROPOSERS_AND_EXECUTORS = [
        '0x9ED07B5DB7dAD3C9a0baA3E320E68Ce779063249',
        '0x36e19bc6374c9cea5eb86622cf04c6b144b5b59c',
        '0x56fa2d29a54b5349cd5d88ffa584bffb2986a656',
        '0x9a78ecd77595ea305c6e5a0daed3669b17801d09',
        '0xb5ad0c32fc5fcb5e4cba4c81f523e6d47a82ecd7',
        '0xb906dc99340d0f3162dbc5b2539b0ad075649bcf',
    ];

    await factoryDeployer.deployWithFactory(new TimelockController__factory(), [
        WEEK_IN_SECONDS,
        PROPOSERS_AND_EXECUTORS,
        PROPOSERS_AND_EXECUTORS,
        owner.address,
    ]);
};

// Add deployment tags
module.exports.tags = ['TimelockController'];
