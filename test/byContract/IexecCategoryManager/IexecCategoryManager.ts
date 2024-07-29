// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

describe('CategoryManager', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAnyone]: IexecInterfaceNative[] = [];
    let [iexecAdmin, anyone]: SignerWithAddress[] = [];

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, anyone } = accounts);
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, iexecAdmin);
        iexecPocoAsAnyone = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
    }

    describe('view', async () => {
        describe('invalid index', async () => {
            it('reverts', async () => {
                expect(await iexecPocoAsAnyone.countCategory()).to.equal(5);
                await expect(iexecPocoAsAnyone.viewCategory(5)).to.be.revertedWithoutReason();
            });
        });
    });

    describe('create', async () => {
        describe('unauthorized create', async () => {
            it('reverts', async () => {
                await expect(
                    iexecPocoAsAnyone.createCategory(
                        'fake category',
                        'this is an attack',
                        0xffffffffff,
                    ),
                ).to.be.revertedWith('Ownable: caller is not the owner');
            });
        });

        describe('authorized', async () => {
            it('success', async () => {
                const name = 'Tiny';
                const description = 'Small but impractical';
                const timeRef = 3;
                const newCategoryIndex = 5;
                const txMined = await iexecPoco.createCategory(name, description, timeRef);
                await expect(txMined)
                    .to.emit(iexecPoco, 'CreateCategory')
                    .withArgs(newCategoryIndex, name, description, timeRef);
                expect(await iexecPocoAsAnyone.countCategory()).to.equal(6);
                const category = await iexecPocoAsAnyone.viewCategory(newCategoryIndex);
                expect(category.name).to.equal(name);
                expect(category.description).to.equal(description);
                expect(category.workClockTimeRef).to.equal(timeRef);
            });
        });
    });
});
