// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture, setStorageAt } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers, expect } from 'hardhat';
import CONFIG from '../../../config/config.json';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const depositAmount = BigNumber.from(100);
const nativeDepositAmount = toNativeAmount(depositAmount);
const depositArgs = [{ value: nativeDepositAmount }] as [{ value: BigNumber }];
const withdrawAmount = BigNumber.from(100);
const withdrawArg = [withdrawAmount] as [BigNumber];

// TODO: remove this when poco is also available in Native mode
if (CONFIG.chains.default.asset === 'Native') {
    describe('EscrowNative', () => {
        let proxyAddress: string;
        let [iexecPoco, , iexecPocoAsAccountA, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
        let [iexecAdmin, accountA, accountB, anyone]: SignerWithAddress[] = [];

        beforeEach('Deploy', async () => {
            proxyAddress = await loadHardhatFixtureDeployment();
            await loadFixture(initFixture);
        });

        async function initFixture() {
            const accounts = await getIexecAccounts();
            ({ iexecAdmin, anyone: accountA, requester: accountB, anyone } = accounts);

            iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
            iexecPocoAsAccountA = iexecPoco.connect(accountA);
            iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
        }

        describe('Receive and Fallback', () => {
            it('Should receive', async () => {
                await expect(
                    accountA.sendTransaction({
                        to: iexecPoco.address,
                        value: nativeDepositAmount,
                    }),
                )
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositAmount, nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should fallback', async () => {
                const randomData = ethers.utils.hexlify(
                    ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
                );

                await expect(
                    accountA.sendTransaction({
                        to: iexecPoco.address,
                        value: nativeDepositAmount,
                        data: randomData,
                    }),
                )
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositAmount, nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });
        });

        // TODO 'Should deposit with zero value'
        describe('Deposit', () => {
            it('Should deposit native tokens', async () => {
                expect(await iexecPocoAsAccountA.callStatic.deposit(...depositArgs)).to.be.true;
                await expect(iexecPocoAsAccountA.deposit(...depositArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositAmount, nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should deposit native tokens and return remainder', async () => {
                // Create a small remainder value using BigNumber, bypassing underflow error
                const depositRemainder = BigNumber.from(10).div(BigNumber.from(100));
                const depositAmountWithRemainder = depositAmount.add(depositRemainder);
                const nativeDepositAmountWithRemainder = toNativeAmount(depositAmountWithRemainder);

                await expect(
                    iexecPocoAsAccountA.deposit({ value: nativeDepositAmountWithRemainder }),
                )
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositAmount, nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });
        });

        describe('Deposit for', () => {
            it('Should deposit native tokens for another address', async () => {
                const depositForArgs = [accountB.address, ...depositArgs] as [
                    string,
                    { value: BigNumber },
                ];
                expect(await iexecPocoAsAccountA.callStatic.depositFor(...depositForArgs)).to.be
                    .true;
                await expect(iexecPocoAsAccountA.depositFor(...depositForArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositAmount, nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountB], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmount);
            });
        });

        describe('Deposit for array', () => {
            it('Should depositForArray with exact value and good array lengths', async () => {
                const depositAmounts = [depositAmount.mul(2), depositAmount];
                const nativeDepositTotalAmount = toNativeAmount(getTotalAmount(depositAmounts));
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: nativeDepositTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];

                expect(await iexecPocoAsAccountA.callStatic.depositForArray(...depositForArrayArgs))
                    .to.be.true;
                await expect(iexecPocoAsAccountA.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-nativeDepositTotalAmount, nativeDepositTotalAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [iexecAdmin, accountB], [...depositAmounts])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, depositAmounts[0])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmounts[1]);
            });

            it('Should depositForArray with good array lengths and remainder value sent', async () => {
                const depositAmounts = [depositAmount.mul(2), depositAmount];
                const remainderNativeAmount = toNativeAmount(depositAmount);
                const nativeDepositTotalAmount = toNativeAmount(
                    getTotalAmount(depositAmounts).add(remainderNativeAmount),
                );
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: nativeDepositTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];
                await expect(iexecPocoAsAccountA.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [
                            -nativeDepositTotalAmount.sub(remainderNativeAmount),
                            nativeDepositTotalAmount.sub(remainderNativeAmount),
                        ],
                    )
                    .to.changeTokenBalances(iexecPoco, [iexecAdmin, accountB], [...depositAmounts])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, depositAmounts[0])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmounts[1]);
            });

            it('Should not depositForArray with mismatched array lengths', async () => {
                const depositAmounts = [depositAmount.mul(2), depositAmount, depositAmount.div(2)];
                const nativeDepositTotalAmount = toNativeAmount(getTotalAmount(depositAmounts));
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: nativeDepositTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];

                await expect(
                    iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
                ).to.be.revertedWith('invalid-array-length');
            });
        });

        // TODO 'Should withdraw with zero value'
        describe('Withdraw', () => {
            it('Should withdraw native tokens', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);

                expect(await iexecPocoAsAccountA.callStatic.withdraw(...withdrawArg)).to.be.true;
                await expect(iexecPocoAsAccountA.withdraw(...withdrawArg))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [nativeDepositAmount, -nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });

            it('Should not withdraw native tokens with empty balance', async () => {
                await expect(
                    iexecPocoAsAccountA.withdraw(...withdrawArg),
                ).to.be.revertedWithoutReason();
            });

            it('Should not withdraw native tokens with insufficient balance', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);

                await expect(
                    iexecPocoAsAccountA.withdraw(depositAmount.mul(2)),
                ).to.be.revertedWithoutReason();
            });
        });

        describe('Withdraw to', () => {
            it('Should withdraw native tokens to another address', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);
                const withdrawToArgs = [...withdrawArg, accountB.address] as [BigNumber, string];
                expect(await iexecPocoAsAccountA.callStatic.withdrawTo(...withdrawToArgs)).to.be
                    .true;
                await expect(iexecPocoAsAccountA.withdrawTo(...withdrawToArgs))
                    .to.changeEtherBalances(
                        [accountB, iexecPoco],
                        [nativeDepositAmount, -nativeDepositAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });
        });

        describe('Recover', () => {
            it('Should recover from balance deviation', async () => {
                await iexecAdmin.sendTransaction({
                    to: iexecPoco.address,
                    value: nativeDepositAmount,
                });
                const initTotalSupply = await iexecPoco.totalSupply();
                expect(initTotalSupply).to.equal(depositAmount);

                const expectDelta = BigNumber.from(5);
                await setStorageAt(
                    proxyAddress,
                    '0x0c', // Slot index of `m_totalSupply` in Store
                    initTotalSupply.sub(expectDelta).toHexString(),
                );
                expect(await iexecPoco.totalSupply()).to.equal(
                    initTotalSupply.sub(expectDelta).toHexString(),
                );

                expect(await iexecPocoAsAdmin.callStatic.recover()).to.equal(expectDelta);
                await expect(iexecPocoAsAdmin.recover())
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, expectDelta);

                expect(await iexecPoco.totalSupply()).to.equal(initTotalSupply);
            });

            it('Should not recover extra balance when caller is not owner', async () => {
                await expect(iexecPocoAsAccountA.recover()).to.be.revertedWith(
                    'Ownable: caller is not the owner',
                );
            });
        });
    });
}

function getTotalAmount(amounts: BigNumber[]) {
    return amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
}

function toNativeAmount(depositAmount: BigNumber) {
    return ethers.utils.parseUnits(depositAmount.toString(), 9);
}
