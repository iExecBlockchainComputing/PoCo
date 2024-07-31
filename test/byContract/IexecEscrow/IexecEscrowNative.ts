// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import constants from '../../../utils/constants';
import { getIexecAccounts } from '../../../utils/poco-tools';

const CONFIG = require('../../../config/config.json');

describe('EscrowNative', async () => {
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

    it('Should call fallback successfully', async () => {
        const depositAmount = 100;
        const depositedAmountEther = ethers.utils.parseUnits(depositAmount.toString(), 9);

        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

        const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

        const tx = await anyone.sendTransaction({
            to: iexecPoco.address,
            value: depositedAmountEther,
        });

        await expect(tx)
            .to.changeEtherBalances(
                [anyone, iexecPoco],
                [-depositedAmountEther, depositedAmountEther],
            )
            .to.emit(iexecPocoAsAnyone, 'Transfer')
            .withArgs(constants.NULL.ADDRESS, anyone.address, depositAmount);

        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(depositAmount);
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
            initialNativeBalance.sub(depositedAmountEther),
        );

        expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(depositedAmountEther);
    });

    describe('Deposits', function () {
        it('Should deposit native tokens', async () => {
            const depositAmount = 100;
            const depositedAmountEther = ethers.utils.parseUnits(depositAmount.toString(), 9);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
            const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

            const tx = await iexecPocoAsAnyone.deposit({
                value: depositedAmountEther,
            });

            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [-depositedAmountEther, depositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(constants.NULL.ADDRESS, anyone.address, depositAmount);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(depositAmount);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
            const newNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);
            expect(newNativeBalance).to.be.below(initialNativeBalance.sub(depositAmount));

            const contractBalance = await ethers.provider.getBalance(iexecPoco.address);
            expect(contractBalance).to.equal(depositedAmountEther);
        });

        it('Should deposit native tokens for another address', async () => {
            const depositAmount = 100;
            const depositedAmountEther = ethers.utils.parseUnits(depositAmount.toString(), 9);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            const tx = await iexecPoco.depositFor(anyone.address, {
                value: depositedAmountEther,
            });

            await expect(tx)
                .to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-depositedAmountEther, depositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(constants.NULL.ADDRESS, anyone.address, depositAmount);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(depositAmount);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            const contractBalance = await ethers.provider.getBalance(iexecPoco.address);
            expect(contractBalance).to.equal(depositedAmountEther);
        });

        it('Should depositForArray with exact value and good arrays lengths', async () => {
            const amounts = [200, 100];
            const totalAmount = amounts.reduce((a, b) => a + b, 0);
            const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
            const targets = [iexecAdmin.address, anyone.address];

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            const tx = await iexecPoco.depositForArray(amounts, targets, {
                value: nativeAmountSent,
            });

            await expect(tx)
                .to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-nativeAmountSent, nativeAmountSent],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(constants.NULL.ADDRESS, iexecAdmin.address, amounts[0])
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(constants.NULL.ADDRESS, anyone.address, amounts[1]);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(amounts[0]);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(amounts[1]);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        it('Should depositForArray with good arrays lengths and excess native value sent', async () => {
            const amounts = [200, 100];
            const totalAmount = amounts.reduce((a, b) => a + b, 0);
            const excessAmount = 100;
            const excessAmountWei = ethers.utils.parseUnits(excessAmount.toString(), 9);
            const nativeAmountSent = ethers.utils.parseUnits(
                (totalAmount + excessAmount).toString(),
                9,
            );
            const targets = [iexecAdmin.address, anyone.address];

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            const initialNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            const tx = await iexecPoco.depositForArray(amounts, targets, {
                value: nativeAmountSent,
            });

            await expect(tx)
                .to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-nativeAmountSent.sub(excessAmountWei), nativeAmountSent.sub(excessAmountWei)],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(constants.NULL.ADDRESS, iexecAdmin.address, amounts[0]);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(amounts[0]);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            const finalNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);
            expect(finalNativeBalance).to.equal(
                initialNativeBalance.sub(nativeAmountSent).add(excessAmountWei),
            );

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(amounts[1]);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        it('Should revert on depositForArray when amounts.length != target.length', async () => {
            const amounts = [200, 100, 50];
            const totalAmount = amounts.reduce((a, b, c) => a + b + c, 0);
            const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
            const targets = [iexecAdmin.address, anyone.address];

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            await expect(
                iexecPoco.depositForArray(amounts, targets, {
                    value: nativeAmountSent,
                }),
            ).to.be.revertedWith('invalid-array-length');
        });
    });

    describe('Withdrawals', function () {
        it('Should withdraw native tokens', async () => {
            const depositAmount = 100;
            const depositedAmountEther = ethers.utils.parseUnits(depositAmount.toString(), 9);

            await iexecPocoAsAnyone.deposit({
                value: depositedAmountEther,
            });

            const tx = await iexecPocoAsAnyone.withdraw(depositAmount);

            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [depositedAmountEther, -depositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(anyone.address, constants.NULL.ADDRESS, depositAmount);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        // it("Should withdraw native tokens to another address", async () => {
        // });
    });

    // it('Should withdraw native tokens', async () => {
    //
    // });

    // it('Should withdraw to another address', async () => {
    //
    // });

    // it('Should recover extra balance', async () => {
    // });

    //   describe("Withdrawals", function () {
    //   });

    //   describe("Recover", function () {
    //   });
});
