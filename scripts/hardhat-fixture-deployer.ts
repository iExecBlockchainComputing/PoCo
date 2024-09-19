// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers } from 'hardhat';
import { IexecInterfaceNative__factory } from '../typechain';
import { getIexecAccounts } from '../utils/poco-tools';
const { resetNetworkToInitialState } = require('./common-test-snapshot');
const deploy = require('../deploy/0_deploy');
const deployEns = require('../deploy/1_deploy-ens');

// Anonymous functions cannot be used as fixtures, hence we need to wrap body
// in a method which will be called by `loadFixture`.
async function resetNetworkAndDeployAllContracts() {
    let proxyAddress;
    if (process.env.LOCAL_FORK != 'true') {
        await resetNetworkToInitialState();
        await deploy();
        await deployEns();
        proxyAddress = (await deployments.get('ERC1538Proxy')).address;
    } else {
        // Deploy upgrade here for tests
        // await deployModules();
        // proxyAddress = await addModulesToProxy();
        proxyAddress = '0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f';
        const srlcRichSigner = await ethers.getImpersonatedSigner(proxyAddress);
        const AMOUNT =
            10 * // Give this much RLC per account
            10 ** 9;
        const accounts = await getIexecAccounts();
        const accountsArray = Object.values(accounts) as SignerWithAddress[];
        console.log(`Rich account ${srlcRichSigner.address} sending RLCs to other accounts..`);
        for (let i = 0; i < accountsArray.length; i++) {
            const account = accountsArray[i];
            await IexecInterfaceNative__factory.connect(proxyAddress, srlcRichSigner)
                .transfer(account.address, AMOUNT)
                .then((tx) => tx.wait());
            const balance2 = await IexecInterfaceNative__factory.connect(
                proxyAddress,
                ethers.provider,
            )
                .balanceOf(account.address)
                .then((x) => x.toNumber());
            console.log(`Account #${i}: ${account.address} (${balance2.toLocaleString()} nRLC)`);
        }
    }
    return proxyAddress;
}

/**
 * @returns proxy address.
 */
export const loadHardhatFixtureDeployment = async () => {
    console.log('Running hardhat-fixture');
    return await loadFixture(resetNetworkAndDeployAllContracts);
};
