// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { duration } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import hre, { ethers } from 'hardhat';
import { TimelockController__factory } from '../typechain';
import { FactoryDeployerHelper } from '../utils/FactoryDeployerHelper';
import config from '../utils/config';

/**
 * Deploy TimelockController contract using the generic factory.
 */

export const deploy = async () => {
    console.log('Deploying TimelockController..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await hre.ethers.getSigners();
    const salt =
        process.env.SALT ||
        config.getChainConfig(chainId).v5.salt ||
        config.getDefaultChainConfig().v5.salt;

    // Initialize factory deployer
    const factoryDeployer = new FactoryDeployerHelper(owner, salt);

    // Deploy TimelockController
    const ONE_WEEK_IN_SECONDS = duration.days(7);
    const ADMINISTRATORS = [
        '0x9ED07B5DB7dAD3C9a0baA3E320E68Ce779063249',
        '0x36e19bc6374c9cea5eb86622cf04c6b144b5b59c',
        '0x56fa2d29a54b5349cd5d88ffa584bffb2986a656',
        '0x9a78ecd77595ea305c6e5a0daed3669b17801d09',
        '0xb5ad0c32fc5fcb5e4cba4c81f523e6d47a82ecd7',
        '0xb906dc99340d0f3162dbc5b2539b0ad075649bcf',
    ];
    const PROPOSERS = [
        '0x0B3a38b0A47aB0c5E8b208A703de366751Df5916', // v5 deployer
    ];
    const EXECUTORS = [
        '0x0B3a38b0A47aB0c5E8b208A703de366751Df5916', // v5 deployer
    ];
    const constructorArgs = [ONE_WEEK_IN_SECONDS, ADMINISTRATORS, PROPOSERS, EXECUTORS];
    const timelockFactory = new TimelockController__factory(owner);
    await factoryDeployer.deployWithFactory(timelockFactory, constructorArgs);
};

if (require.main === module) {
    deploy().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
