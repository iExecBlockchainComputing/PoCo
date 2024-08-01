// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers, expect } from 'hardhat';
import CONFIG from '../../../config/config.json';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const depositAmount = BigNumber.from(100);
const etherDepositAmount = ethers.utils.parseUnits(depositAmount.toString(), 9);
const depositArgs = [{ value: etherDepositAmount }] as [{ value: BigNumber }];

if (CONFIG.chains.default.asset === 'Native') {
    describe('EscrowNative', () => {
        let proxyAddress: string;
        let [iexecPoco, iexecPocoAsAnyone]: IexecInterfaceNative[] = [];
        let [iexecAdmin, anyoneA, anyoneB, anyone]: SignerWithAddress[] = [];

        beforeEach('Deploy', async () => {
            proxyAddress = await loadHardhatFixtureDeployment();
            await loadFixture(initFixture);
        });

        async function initFixture() {
            const accounts = await getIexecAccounts();
            ({ iexecAdmin, anyone: anyoneA, requester: anyoneB, anyone } = accounts);

            iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, iexecAdmin);
            iexecPocoAsAnyone = iexecPoco.connect(anyone);
        }

        async function checkBalances(address: string, expectedBalance: BigNumber) {
            expect(await iexecPocoAsAnyone.balanceOf(address)).to.equal(expectedBalance);
        }

        describe('Receive and Fallback', () => {
            it('Should call receive successfully', async () => {
                await checkBalances(anyoneA.address, BigNumber.from(0));
                const initialBalance = await ethers.provider.getBalance(anyoneA.address);
                await expect(
                    await anyoneA.sendTransaction({
                        to: iexecPoco.address,
                        value: etherDepositAmount,
                    }),
                )
                    .to.changeEtherBalances(
                        [anyoneA, iexecPoco],
                        [-etherDepositAmount, etherDepositAmount],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, depositAmount);

                await checkBalances(anyoneA.address, depositAmount);
                expect(await ethers.provider.getBalance(anyoneA.address)).to.equal(
                    initialBalance.sub(etherDepositAmount),
                );
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    etherDepositAmount,
                );
            });

            it('Should call fallback successfully', async () => {
                await checkBalances(anyoneA.address, BigNumber.from(0));
                const initialBalance = await ethers.provider.getBalance(anyoneA.address);
                const randomData = ethers.utils.hexlify(
                    ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
                );

                await expect(
                    await anyoneA.sendTransaction({
                        to: iexecPoco.address,
                        value: etherDepositAmount,
                        data: randomData,
                    }),
                )
                    .to.changeEtherBalances(
                        [anyoneA, iexecPoco],
                        [-etherDepositAmount, etherDepositAmount],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, depositAmount);

                await checkBalances(anyoneA.address, depositAmount);
                expect(await ethers.provider.getBalance(anyoneA.address)).to.equal(
                    initialBalance.sub(etherDepositAmount),
                );
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    etherDepositAmount,
                );
            });
        });

        describe('Deposits', () => {
            it('Should deposit native tokens', async () => {
                await checkBalances(anyoneA.address, BigNumber.from(0));
                const initialBalance = await ethers.provider.getBalance(anyoneA.address);

                expect(await iexecPocoAsAnyone.callStatic.deposit(...depositArgs)).to.be.true;
                await expect(iexecPocoAsAnyone.deposit(...depositArgs))
                    .to.changeEtherBalances(
                        [anyoneA, iexecPoco],
                        [-etherDepositAmount, etherDepositAmount],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, depositAmount);

                await checkBalances(anyoneA.address, depositAmount);
                expect(await ethers.provider.getBalance(anyoneA.address)).to.equal(
                    initialBalance.sub(etherDepositAmount),
                );
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    etherDepositAmount,
                );
            });

            it('Should deposit native tokens for another address', async () => {
                await checkBalances(iexecAdmin.address, BigNumber.from(0));
                await checkBalances(anyoneA.address, BigNumber.from(0));

                const depositForArgs = [anyoneA.address, { value: etherDepositAmount }] as [
                    string,
                    { value: BigNumber },
                ];
                expect(await iexecPoco.callStatic.depositFor(...depositForArgs)).to.be.true;
                await expect(iexecPoco.depositFor(...depositForArgs))
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [-etherDepositAmount, etherDepositAmount],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, depositAmount);

                await checkBalances(iexecAdmin.address, BigNumber.from(0));
                await checkBalances(anyoneA.address, depositAmount);
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    etherDepositAmount,
                );
            });

            it('Should depositForArray with exact value and good array lengths', async () => {
                const amounts = [depositAmount.mul(2), depositAmount];
                const totalAmount = amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
                const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
                const targets = [anyoneA.address, anyoneB.address];
                const depositForArrayArgs = [amounts, targets, { value: nativeAmountSent }] as [
                    BigNumber[],
                    string[],
                    { value: BigNumber },
                ];

                await checkBalances(anyoneA.address, BigNumber.from(0));
                await checkBalances(anyoneB.address, BigNumber.from(0));

                expect(await iexecPoco.callStatic.depositForArray(...depositForArrayArgs)).to.be
                    .true;
                await expect(iexecPoco.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [-nativeAmountSent, nativeAmountSent],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, amounts[0])
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneB.address, amounts[1]);

                await checkBalances(anyoneA.address, amounts[0]);
                await checkBalances(anyoneB.address, amounts[1]);
            });

            it('Should depositForArray with good array lengths and excess value sent', async () => {
                const amounts = [depositAmount.mul(2), depositAmount];
                const totalAmount = amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
                const excessAmount = depositAmount;
                const excessAmountWei = ethers.utils.parseUnits(excessAmount.toString(), 9);
                const nativeAmountSent = ethers.utils.parseUnits(
                    totalAmount.add(excessAmount).toString(),
                    9,
                );
                const targets = [anyoneA.address, anyoneB.address];
                const depositForArrayArgs = [amounts, targets, { value: nativeAmountSent }] as [
                    BigNumber[],
                    string[],
                    { value: BigNumber },
                ];

                const initialBalance = await ethers.provider.getBalance(iexecAdmin.address);
                await checkBalances(anyoneA.address, BigNumber.from(0));
                await checkBalances(anyoneB.address, BigNumber.from(0));

                await expect(await iexecPoco.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [
                            -nativeAmountSent.sub(excessAmountWei),
                            nativeAmountSent.sub(excessAmountWei),
                        ],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneA.address, amounts[0])
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(AddressZero, anyoneB.address, amounts[1]);

                expect(await ethers.provider.getBalance(iexecAdmin.address)).to.equal(
                    initialBalance.sub(nativeAmountSent).add(excessAmountWei),
                );

                await checkBalances(anyoneA.address, amounts[0]);
                await checkBalances(anyoneB.address, amounts[1]);
            });

            it('Should not depositForArray with mismatched array lengths', async () => {
                const amounts = [depositAmount.mul(2), depositAmount, depositAmount.div(2)];
                const totalAmount = amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
                const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
                const targets = [anyoneA.address, anyoneB.address];
                const depositForArrayArgs = [amounts, targets, { value: nativeAmountSent }] as [
                    BigNumber[],
                    string[],
                    { value: BigNumber },
                ];

                await checkBalances(anyoneA.address, BigNumber.from(0));
                await checkBalances(anyoneB.address, BigNumber.from(0));

                await expect(iexecPoco.depositForArray(...depositForArrayArgs)).to.be.revertedWith(
                    'invalid-array-length',
                );
            });
        });

        describe('Withdrawals', () => {
            it('Should withdraw native tokens', async () => {
                await iexecPocoAsAnyone.deposit(...depositArgs);

                const withdrawArg = [depositAmount] as [BigNumber];
                expect(await iexecPocoAsAnyone.callStatic.withdraw(...withdrawArg)).to.be.true;
                await expect(iexecPocoAsAnyone.withdraw(...withdrawArg))
                    .to.changeEtherBalances(
                        [anyoneA, iexecPoco],
                        [etherDepositAmount, -etherDepositAmount],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(anyoneA.address, AddressZero, depositAmount);

                await checkBalances(anyoneA.address, BigNumber.from(0));
            });

            it('Should withdraw native tokens to another address', async () => {
                await expect(iexecPoco.deposit(...depositArgs)).to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-etherDepositAmount, etherDepositAmount],
                );
                expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.equal(
                    depositAmount,
                );

                const withdrawToArgs = [depositAmount, anyoneA.address] as [BigNumber, string];
                expect(await iexecPoco.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
                await expect(iexecPoco.withdrawTo(...withdrawToArgs))
                    .to.changeEtherBalances(
                        [anyoneA, iexecPoco],
                        [etherDepositAmount, -etherDepositAmount],
                    )
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecAdmin.address, AddressZero, depositAmount);

                expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.equal(0);
            });

            it('Should not withdraw native tokens with empty balance', async () => {
                await expect(
                    iexecPocoAsAnyone.withdraw(depositAmount),
                ).to.be.revertedWithoutReason();
            });

            it('Should not withdraw native tokens with insufficient balance', async () => {
                await iexecPocoAsAnyone.deposit(...depositArgs);

                await expect(
                    iexecPocoAsAnyone.withdraw(depositAmount.mul(2)),
                ).to.be.revertedWithoutReason();
            });
        });

        describe('Recover', () => {
            it('Should recover extra balance', async () => {
                await iexecAdmin.sendTransaction({
                    to: iexecPoco.address,
                    value: etherDepositAmount,
                });
                const delta = 0;
                expect(await iexecPoco.callStatic.recover()).to.equal(delta);

                await expect(iexecPoco.recover())
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, delta);
            });

            it('Should not recover extra balance when caller is not owner', async () => {
                await expect(iexecPocoAsAnyone.recover()).to.be.revertedWith(
                    'Ownable: caller is not the owner',
                );
            });
        });
    });
}
