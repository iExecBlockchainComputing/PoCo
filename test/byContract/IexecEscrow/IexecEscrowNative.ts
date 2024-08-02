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
const withdrawAmount = BigNumber.from(100);
const deposiNativetAmount = ethers.utils.parseUnits(depositAmount.toString(), 9);
const depositArgs = [{ value: deposiNativetAmount }] as [{ value: BigNumber }];

// TODO: remove this when poco is also available in Native mode
if (CONFIG.chains.default.asset === 'Native') {
    describe('EscrowNative', () => {
        let proxyAddress: string;
        let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
        let [iexecAdmin, accountA, accountB, anyone]: SignerWithAddress[] = [];

        beforeEach('Deploy', async () => {
            proxyAddress = await loadHardhatFixtureDeployment();
            await loadFixture(initFixture);
        });

        async function initFixture() {
            const accounts = await getIexecAccounts();
            ({ iexecAdmin, anyone: accountA, requester: accountB, anyone } = accounts);

            iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
            iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
        }

        describe('Receive and Fallback', () => {
            it('Should call receive successfully', async () => {
                await expect(
                    accountA.sendTransaction({
                        to: iexecPoco.address,
                        value: deposiNativetAmount,
                    }),
                )
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-deposiNativetAmount, deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should call fallback successfully', async () => {
                const randomData = ethers.utils.hexlify(
                    ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
                );

                await expect(
                    accountA.sendTransaction({
                        to: iexecPoco.address,
                        value: deposiNativetAmount,
                        data: randomData,
                    }),
                )
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-deposiNativetAmount, deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });
        });

        describe('Deposits', () => {
            it('Should deposit native tokens', async () => {
                expect(await iexecPoco.callStatic.deposit(...depositArgs)).to.be.true;
                await expect(iexecPoco.deposit(...depositArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-deposiNativetAmount, deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should deposit native tokens for another address', async () => {
                const depositForArgs = [accountB.address, { value: deposiNativetAmount }] as [
                    string,
                    { value: BigNumber },
                ];
                expect(await iexecPoco.callStatic.depositFor(...depositForArgs)).to.be.true;
                await expect(iexecPoco.depositFor(...depositForArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-deposiNativetAmount, deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountB], [depositAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmount);
            });

            it('Should depositForArray with exact value and good array lengths', async () => {
                const depositAmounts = [depositAmount.mul(2), depositAmount];
                const deposiNativetTotalAmount = ethers.utils.parseUnits(
                    getTotalAmount(depositAmounts).toString(),
                    9,
                );
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: deposiNativetTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];

                expect(await iexecPoco.callStatic.depositForArray(...depositForArrayArgs)).to.be
                    .true;
                await expect(iexecPoco.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [-deposiNativetTotalAmount, deposiNativetTotalAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [iexecAdmin, accountB], [...depositAmounts])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, depositAmounts[0])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmounts[1]);
            });

            it('Should depositForArray with good array lengths and excess value sent', async () => {
                const depositAmounts = [depositAmount.mul(2), depositAmount];
                const excessNativeAmount = ethers.utils.parseUnits(depositAmount.toString(), 9);
                const deposiNativetTotalAmount = ethers.utils.parseUnits(
                    getTotalAmount(depositAmounts).add(excessNativeAmount).toString(),
                    9,
                );
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: deposiNativetTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];
                await expect(iexecPoco.depositForArray(...depositForArrayArgs))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [
                            -deposiNativetTotalAmount.sub(excessNativeAmount),
                            deposiNativetTotalAmount.sub(excessNativeAmount),
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
                const deposiNativetTotalAmount = ethers.utils.parseUnits(
                    getTotalAmount(depositAmounts).toString(),
                    9,
                );
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: deposiNativetTotalAmount },
                ] as [BigNumber[], string[], { value: BigNumber }];

                await expect(iexecPoco.depositForArray(...depositForArrayArgs)).to.be.revertedWith(
                    'invalid-array-length',
                );
            });
        });

        describe('Withdrawals', () => {
            it('Should withdraw native tokens', async () => {
                await iexecPoco.deposit(...depositArgs);

                const withdrawArg = [withdrawAmount] as [BigNumber];
                expect(await iexecPoco.callStatic.withdraw(...withdrawArg)).to.be.true;
                await expect(iexecPoco.withdraw(...withdrawArg))
                    .to.changeEtherBalances(
                        [accountA, iexecPoco],
                        [deposiNativetAmount, -deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });

            it('Should withdraw native tokens to another address', async () => {
                await iexecPoco.deposit(...depositArgs);
                const withdrawToArgs = [withdrawAmount, accountB.address] as [BigNumber, string];
                expect(await iexecPoco.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
                await expect(iexecPoco.withdrawTo(...withdrawToArgs))
                    .to.changeEtherBalances(
                        [accountB, iexecPoco],
                        [deposiNativetAmount, -deposiNativetAmount],
                    )
                    .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });

            it('Should not withdraw native tokens with empty balance', async () => {
                await expect(iexecPoco.withdraw(withdrawAmount)).to.be.revertedWithoutReason();
            });

            it('Should not withdraw native tokens with insufficient balance', async () => {
                await iexecPoco.deposit(...depositArgs);

                await expect(
                    iexecPoco.withdraw(depositAmount.mul(2)),
                ).to.be.revertedWithoutReason();
            });
        });

        describe('Recover', () => {
            it('Should recover extra balance', async () => {
                await iexecAdmin.sendTransaction({
                    to: iexecPoco.address,
                    value: deposiNativetAmount,
                });
                const delta = 0;
                expect(await iexecPocoAsAdmin.callStatic.recover()).to.equal(delta);

                await expect(iexecPocoAsAdmin.recover())
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, delta);
            });

            it('Should not recover extra balance when caller is not owner', async () => {
                await expect(iexecPoco.recover()).to.be.revertedWith(
                    'Ownable: caller is not the owner',
                );
            });
        });
    });
}

function getTotalAmount(amounts: BigNumber[]) {
    return amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
}
