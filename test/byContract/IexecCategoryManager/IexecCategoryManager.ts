// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { Category, getIexecAccounts } from '../../../utils/poco-tools';
const CONFIG = require('../../../config/config.json');

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

    it('Should view categories', async () => {
        const categories = CONFIG.categories as Category[];
        for (let i = 0; i < categories.length; i++) {
            const expectedCategory = categories[i];
            const category = await iexecPocoAsAnyone.viewCategory(i);
            expect(category.name).to.equal(expectedCategory.name);
            expect(category.description).to.equal(JSON.stringify(expectedCategory.description));
            expect(category.workClockTimeRef).to.equal(expectedCategory.workClockTimeRef);
        }
    });

    it('Should not view category with bad index', async () => {
        // Highest valid index is 4.
        await expect(iexecPocoAsAnyone.viewCategory(5)).to.be.revertedWithoutReason();
    });

    it('Should create category', async () => {
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

    it('Should not create category when sender not authorized', async () => {
        await expect(
            iexecPocoAsAnyone.createCategory('fake category', 'this is an attack', 0xffffffffff),
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });
});
