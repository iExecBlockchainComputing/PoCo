// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const singleDepositedAmount = 100;
const singleDepositedAmountEther = ethers.utils.parseUnits(singleDepositedAmount.toString(), 9);

const zeroAddress = ethers.constants.AddressZero;

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

    it('Should call receive successfully', async () => {
        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

        const tx = await anyone.sendTransaction({
            to: iexecPoco.address,
            value: singleDepositedAmountEther,
        });
        await expect(tx)
            .to.changeEtherBalances(
                [anyone, iexecPoco],
                [-singleDepositedAmountEther, singleDepositedAmountEther],
            )
            .to.emit(iexecPocoAsAnyone, 'Transfer')
            .withArgs(zeroAddress, anyone.address, singleDepositedAmount);

        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(
            singleDepositedAmount,
        );
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
            initialNativeBalance.sub(singleDepositedAmountEther),
        );
        expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
            singleDepositedAmountEther,
        );
    });

    it('Should call fallback successfully', async () => {
        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        const initialNativeBalance = await ethers.provider.getBalance(anyone.address);
        const randomData = ethers.utils.hexlify(
            ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
        );

        const tx = await anyone.sendTransaction({
            to: iexecPoco.address,
            value: singleDepositedAmountEther,
            data: randomData,
        });
        await expect(tx)
            .to.changeEtherBalances(
                [anyone, iexecPoco],
                [-singleDepositedAmountEther, singleDepositedAmountEther],
            )
            .to.emit(iexecPocoAsAnyone, 'Transfer')
            .withArgs(zeroAddress, anyone.address, singleDepositedAmount);

        expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(
            singleDepositedAmount,
        );
        expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
            initialNativeBalance.sub(singleDepositedAmountEther),
        );
        expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
            singleDepositedAmountEther,
        );
    });

    describe('Deposits', function () {
        it('Should deposit native tokens', async () => {
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
            const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

            const tx = await iexecPocoAsAnyone.deposit({
                value: singleDepositedAmountEther,
            });
            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [-singleDepositedAmountEther, singleDepositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(zeroAddress, anyone.address, singleDepositedAmount);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(
                singleDepositedAmount,
            );
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
            const newNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);
            expect(newNativeBalance).to.be.below(initialNativeBalance.sub(singleDepositedAmount));

            const contractBalance = await ethers.provider.getBalance(iexecPoco.address);
            expect(contractBalance).to.equal(singleDepositedAmountEther);
        });

        it('Should deposit native tokens for another address', async () => {
            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);

            const tx = await iexecPoco.depositFor(anyone.address, {
                value: singleDepositedAmountEther,
            });
            await expect(tx)
                .to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-singleDepositedAmountEther, singleDepositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(zeroAddress, anyone.address, singleDepositedAmount);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(
                singleDepositedAmount,
            );
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
            const contractBalance = await ethers.provider.getBalance(iexecPoco.address);
            expect(contractBalance).to.equal(singleDepositedAmountEther);
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
                .withArgs(zeroAddress, iexecAdmin.address, amounts[0])
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(zeroAddress, anyone.address, amounts[1]);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(amounts[0]);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(amounts[1]);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        it('Should depositForArray with good arrays lengths and excess native value sent', async () => {
            const amounts = [singleDepositedAmount * 2, singleDepositedAmount];
            const totalAmount = amounts.reduce((a, b) => a + b, 0);
            const excessAmount = singleDepositedAmount;
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
                .withArgs(zeroAddress, iexecAdmin.address, amounts[0]);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(amounts[0]);
            expect(await iexecPocoAsAnyone.frozenOf(iexecAdmin.address)).to.be.equal(0);
            const finalNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);
            expect(finalNativeBalance).to.equal(
                initialNativeBalance.sub(nativeAmountSent).add(excessAmountWei),
            );

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(amounts[1]);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        it('Should not depositForArray when amounts.length != target.length', async () => {
            const amounts = [
                singleDepositedAmount * 2,
                singleDepositedAmount,
                singleDepositedAmount / 2,
            ];
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
            await iexecPocoAsAnyone.deposit({
                value: singleDepositedAmountEther,
            });

            const tx = await iexecPocoAsAnyone.withdraw(singleDepositedAmount);
            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [singleDepositedAmountEther, -singleDepositedAmountEther],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(anyone.address, zeroAddress, singleDepositedAmount);

            expect(await iexecPocoAsAnyone.balanceOf(anyone.address)).to.be.equal(0);
            expect(await iexecPocoAsAnyone.frozenOf(anyone.address)).to.be.equal(0);
        });

        it('Should withdraw native tokens to another address', async () => {
            await expect(
                await iexecPoco.deposit({
                    value: singleDepositedAmountEther,
                }),
            ).to.changeEtherBalances(
                [iexecAdmin, iexecPoco],
                [-singleDepositedAmountEther, singleDepositedAmountEther],
            );
            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(
                singleDepositedAmount,
            );

            const tx = await iexecPoco.withdrawTo(singleDepositedAmount, anyone.address);
            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [singleDepositedAmountEther, -singleDepositedAmountEther],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecAdmin.address, zeroAddress, singleDepositedAmount);

            expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
        });

        it('Should not withdraw native tokens when balance is empty', async () => {
            await expect(
                iexecPocoAsAnyone.withdraw(singleDepositedAmount),
            ).to.be.revertedWithoutReason();
        });

        it('Should not withdraw native tokens when balance is insufficient', async () => {
            await iexecPocoAsAnyone.deposit({
                value: singleDepositedAmountEther,
            });

            await expect(
                iexecPocoAsAnyone.withdraw(singleDepositedAmount * 2),
            ).to.be.revertedWithoutReason();
        });
    });
    describe('Recover', function () {
        it('Should recover extra balance', async () => {
            await iexecAdmin.sendTransaction({
                to: iexecPoco.address,
                value: singleDepositedAmountEther,
            });
            const delta = 0;
            const recoverTx = await iexecPoco.recover();
            await expect(recoverTx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(zeroAddress, iexecAdmin.address, delta);
        });

        it('Should not recover extra balance when user is not allowed', async () => {
            await expect(iexecPocoAsAnyone.recover()).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });
});
