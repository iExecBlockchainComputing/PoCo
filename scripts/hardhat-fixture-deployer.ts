// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers } from 'hardhat';
import { IexecInterfaceNative__factory } from '../typechain';
import { getIexecAccounts } from '../utils/poco-tools';
const deploy = require('../deploy/0_deploy');
const deployEns = require('../deploy/1_deploy-ens');

// TODO update and move to test/utils/

// Anonymous functions cannot be used as fixtures, hence we need to wrap body
// in a method which will be called by `loadFixture`.
async function deployAll() {
    await deploy();
    await deployEns();
    return (await deployments.get('ERC1538Proxy')).address;
}

async function setUpLocalFork() {
    const proxyAddress = '0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f';
    // Send RLCs to default accounts
    const srlcRichSigner = await ethers.getImpersonatedSigner(proxyAddress);
    const otherAccountInitAmount =
        10 * // Give this much RLC per account
        10 ** 9;
    const accounts = await getIexecAccounts();
    const accountsArray = Object.values(accounts) as SignerWithAddress[];
    console.log(`Rich account ${srlcRichSigner.address} sending RLCs to other accounts..`);
    const iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
    for (let i = 0; i < accountsArray.length; i++) {
        const account = accountsArray[i];
        await iexecPoco
            .connect(srlcRichSigner)
            .transfer(account.address, otherAccountInitAmount)
            .then((tx) => tx.wait());
        const balance = await iexecPoco.balanceOf(account.address);
        console.log(`Account #${i}: ${account.address} (${balance.toLocaleString()} nRLC)`);
    }
    // Transfer ownership from Timelock to iexecAdmin EOA account
    const timelockAddress = await iexecPoco.owner();
    const timelock = await ethers.getImpersonatedSigner(timelockAddress);
    const newIexecAdminAddress = accounts.iexecAdmin.address;
    console.log(
        `Transferring Poco ownership from Timelock:${timelockAddress} to iexecAdmin:${newIexecAdminAddress}`,
    );
    await iexecPoco
        .connect(timelock)
        .transferOwnership(newIexecAdminAddress)
        .then((tx) => tx.wait());
    return proxyAddress;
}

/**
 * @returns proxy address.
 */
export const loadHardhatFixtureDeployment = async () => {
    return await loadFixture(process.env.LOCAL_FORK != 'true' ? deployAll : setUpLocalFork);
};
