// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployments } from 'hardhat';
const { resetNetworkToInitialState } = require('./common-test-snapshot');
const deploy = require('../deploy/0_deploy');
const deployEns = require('../deploy/1_deploy-ens');

// Anonymous functions cannot be used as fixtures, hence we need to wrap body
// in a method which will be called by `loadFixture`.
async function resetNetworkAndDeployAllContracts() {
    await resetNetworkToInitialState();
    await deploy();
    await deployEns();
}

/**
 * @returns proxy address.
 */
export const loadHardhatFixtureDeployment = async () => {
    console.log('Running hardhat-fixture');
    await loadFixture(resetNetworkAndDeployAllContracts);
    return (await deployments.get('ERC1538Proxy')).address;
};
