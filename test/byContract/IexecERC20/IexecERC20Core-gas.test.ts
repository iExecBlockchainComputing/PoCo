// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const value = 100n;

describe('IexecERC20Core - Gas Measurement', async () => {
    let proxyAddress: string;
    let iexecWrapper: IexecWrapper;
    let testFacet: any;
    let [holder, recipient]: SignerWithAddress[] = [];

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        // Setup current test accounts from some arbitrary iExec accounts
        ({ requester: holder, beneficiary: recipient } = accounts);

        // Connect to the diamond proxy with the IexecERC20Core ABI
        // The functions _transferUnchecked and _burn are now public in IexecERC20Core
        // and automatically exposed via IexecERC20Facet through the Diamond proxy
        const IexecERC20Core = await ethers.getContractFactory('IexecERC20Core');
        testFacet = IexecERC20Core.attach(proxyAddress).connect(holder);

        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        // Deposit some tokens for the holder
        await iexecWrapper.depositInIexecAccount(holder, value * 10n);
    }

    describe('Gas reporting - _transferUnchecked', () => {
        it('Should measure gas for _transferUnchecked (direct call)', async () => {
            // Call _transferUnchecked directly multiple times
            await testFacet._transferUnchecked(holder.address, recipient.address, 10n);
            await testFacet._transferUnchecked(holder.address, recipient.address, 5n);
            await testFacet._transferUnchecked(holder.address, recipient.address, 15n);
            await testFacet._transferUnchecked(holder.address, recipient.address, 20n);
            await testFacet._transferUnchecked(holder.address, recipient.address, 8n);
        });
    });

    describe('Gas reporting - _burn', () => {
        it('Should measure gas for _burn (direct call)', async () => {
            // Call _burn directly multiple times
            await testFacet._burn(holder.address, 10n);
            await testFacet._burn(holder.address, 5n);
            await testFacet._burn(holder.address, 15n);
            await testFacet._burn(holder.address, 20n);
            await testFacet._burn(holder.address, 8n);
        });
    });
});
