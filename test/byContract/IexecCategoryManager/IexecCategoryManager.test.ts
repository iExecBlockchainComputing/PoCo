// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { Category, getIexecAccounts } from '../../../utils/poco-tools';
const CONFIG = require('../../../config/config.json');

const name = 'name';
const description = 'description';
const timeRef = 100;
const args = [name, description, timeRef] as [string, string, number];

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
        iexecPocoAsAnyone = iexecPoco.connect(anyone);
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
        const lastCategoryIndex = (await iexecPocoAsAnyone.countCategory()).toNumber() - 1;
        await expect(
            iexecPocoAsAnyone.viewCategory(lastCategoryIndex + 1),
        ).to.be.revertedWithoutReason();
    });

    it('Should create category', async () => {
        const newCategoryIndex = 5;
        expect(await iexecPoco.callStatic.createCategory(...args)).to.equal(newCategoryIndex);
        await expect(iexecPoco.createCategory(...args))
            .to.emit(iexecPoco, 'CreateCategory')
            .withArgs(newCategoryIndex, name, description, timeRef);
        expect(await iexecPocoAsAnyone.countCategory()).to.equal(6);
        const category = await iexecPocoAsAnyone.viewCategory(newCategoryIndex);
        expect(category.name).to.equal(name);
        expect(category.description).to.equal(description);
        expect(category.workClockTimeRef).to.equal(timeRef);
    });

    it('Should not create category when sender not authorized', async () => {
        await expect(iexecPocoAsAnyone.createCategory(...args)).to.be.revertedWith(
            'Ownable: caller is not the owner',
        );
    });
});
