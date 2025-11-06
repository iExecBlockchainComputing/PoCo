// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, setStorageAt } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import config from '../../../utils/config';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { getPocoStorageSlotLocation } from '../../../utils/proxy-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { setZeroAddressBalance } from '../../utils/utils';

const depositAmount = 100n;
const nativeDepositAmount = toNativeAmount(depositAmount);
const depositArgs = [{ value: nativeDepositAmount }] as [{ value: bigint }];
const withdrawAmount = 100n;
const withdrawArg = [withdrawAmount] as [bigint];

if (config.isNativeChain()) {
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
                const tx = accountA.sendTransaction({
                    to: proxyAddress,
                    value: nativeDepositAmount,
                });
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositAmount, nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [depositAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should fallback', async () => {
                const randomData = ethers.hexlify(
                    ethers.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
                );
                const tx = accountA.sendTransaction({
                    to: proxyAddress,
                    value: nativeDepositAmount,
                    data: randomData,
                });
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositAmount, nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [depositAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });
        });

        describe('Deposit', () => {
            it('Should deposit native tokens', async () => {
                expect(await iexecPocoAsAccountA.deposit.staticCall(...depositArgs)).to.be.true;
                const tx = iexecPocoAsAccountA.deposit(...depositArgs);
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositAmount, nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [depositAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should deposit native tokens and return remainder', async () => {
                const depositRemainder = 333n;
                const nativeDepositAmountWithRemainder = nativeDepositAmount + depositRemainder;
                expect(nativeDepositAmountWithRemainder).to.be.greaterThan(nativeDepositAmount);
                const tx = iexecPocoAsAccountA.deposit({ value: nativeDepositAmountWithRemainder });
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositAmount, nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [depositAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, depositAmount);
            });

            it('Should deposit amount zero', async () => {
                expect(await iexecPocoAsAccountA.deposit.staticCall({ value: 0 })).to.be.true;
                const tx = iexecPocoAsAccountA.deposit({ value: 0 });
                await expect(tx).to.changeEtherBalances([accountA, iexecPoco], [0, 0]);
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [0]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountA.address, 0);
            });

            it('Should not deposit native tokens when caller is address 0', async () => {
                const zeroAddressSigner = await ethers.getImpersonatedSigner(ZeroAddress);
                const iexecPocoAsAddress0 = iexecPoco.connect(zeroAddressSigner);
                await setZeroAddressBalance();
                await expect(iexecPocoAsAddress0.deposit(...depositArgs)).to.be.revertedWith(
                    'ERC20: mint to the zero address',
                );
            });
        });

        describe('Deposit for', () => {
            it('Should deposit native tokens for another address', async () => {
                const depositForArgs = [accountB.address, ...depositArgs] as [
                    string,
                    { value: bigint },
                ];
                expect(await iexecPocoAsAccountA.depositFor.staticCall(...depositForArgs)).to.be
                    .true;
                const tx = iexecPocoAsAccountA.depositFor(...depositForArgs);
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositAmount, nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountB], [depositAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmount);
            });

            it('Should not deposit native tokens for address 0', async () => {
                const depositForArgs = [AddressZero, ...depositArgs] as [string, { value: bigint }];
                await expect(iexecPocoAsAccountA.depositFor(...depositForArgs)).to.be.revertedWith(
                    'ERC20: mint to the zero address',
                );
            });
        });

        describe('Deposit for array', () => {
            it('Should depositForArray with exact value and good array lengths', async () => {
                const depositAmounts = [depositAmount * 2n, depositAmount];
                const nativeDepositTotalAmount = toNativeAmount(getTotalAmount(depositAmounts));
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: nativeDepositTotalAmount },
                ] as [bigint[], string[], { value: bigint }];

                expect(await iexecPocoAsAccountA.depositForArray.staticCall(...depositForArrayArgs))
                    .to.be.true;
                const tx = iexecPocoAsAccountA.depositForArray(...depositForArrayArgs);
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-nativeDepositTotalAmount, nativeDepositTotalAmount],
                );
                await expect(tx).to.changeTokenBalances(
                    iexecPoco,
                    [iexecAdmin, accountB],
                    [...depositAmounts],
                );
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, depositAmounts[0])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmounts[1]);
            });

            it('Should depositForArray with good array lengths and remainder value sent', async () => {
                const depositAmounts = [depositAmount * 2n, depositAmount];
                const remainder = 333n;
                const nativeDepositTotalAmount =
                    toNativeAmount(getTotalAmount(depositAmounts)) + remainder;
                expect(nativeDepositTotalAmount).to.be.greaterThan(getTotalAmount(depositAmounts));
                const targets = [iexecAdmin.address, accountB.address];
                const tx = iexecPocoAsAccountA.depositForArray(depositAmounts, targets, {
                    value: nativeDepositTotalAmount,
                });
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [-(nativeDepositTotalAmount - remainder), nativeDepositTotalAmount - remainder],
                );
                await expect(tx).to.changeTokenBalances(
                    iexecPoco,
                    [iexecAdmin, accountB],
                    [...depositAmounts],
                );
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, depositAmounts[0])
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, accountB.address, depositAmounts[1]);
            });

            it('Should not depositForArray with mismatched array lengths', async () => {
                const depositAmounts = [depositAmount * 2n, depositAmount, depositAmount / 2n];
                const nativeDepositTotalAmount = toNativeAmount(getTotalAmount(depositAmounts));
                const targets = [iexecAdmin.address, accountB.address];
                const depositForArrayArgs = [
                    depositAmounts,
                    targets,
                    { value: nativeDepositTotalAmount },
                ] as [bigint[], string[], { value: bigint }];

                await expect(
                    iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
                ).to.be.revertedWith('invalid-array-length');
            });
        });

        describe('Withdraw', () => {
            it('Should withdraw native tokens', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);

                expect(await iexecPocoAsAccountA.withdraw.staticCall(...withdrawArg)).to.be.true;
                const tx = iexecPocoAsAccountA.withdraw(...withdrawArg);
                await expect(tx).to.changeEtherBalances(
                    [accountA, iexecPoco],
                    [nativeDepositAmount, -nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });

            it('Should withdraw amount zero', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);
                expect(await iexecPocoAsAccountA.withdraw.staticCall(0)).to.be.true;
                const tx = iexecPocoAsAccountA.withdraw(0);
                await expect(tx).to.changeEtherBalances([accountA, iexecPoco], [0, 0]);
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [0]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, 0);
                // User balance haven't changed.
                expect(await iexecPoco.balanceOf(accountA.address)).to.equal(depositAmount);
            });

            it('Should not withdraw native tokens with empty balance', async () => {
                await expect(
                    iexecPocoAsAccountA.withdraw(...withdrawArg),
                ).to.be.revertedWithoutReason();
            });

            it('Should not withdraw native tokens with insufficient balance', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);

                await expect(
                    iexecPocoAsAccountA.withdraw(depositAmount * 2n),
                ).to.be.revertedWithoutReason();
            });
        });

        describe('Withdraw to', () => {
            it('Should withdraw native tokens to another address', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);
                const withdrawToArgs = [...withdrawArg, accountB.address] as [bigint, string];
                expect(await iexecPocoAsAccountA.withdrawTo.staticCall(...withdrawToArgs)).to.be
                    .true;
                const tx = iexecPocoAsAccountA.withdrawTo(...withdrawToArgs);
                await expect(tx).to.changeEtherBalances(
                    [accountB, iexecPoco],
                    [nativeDepositAmount, -nativeDepositAmount],
                );
                await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-withdrawAmount]);
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(accountA.address, AddressZero, withdrawAmount);
            });

            it('Should not withdraw To native tokens with empty balance', async () => {
                const withdrawToArgs = [...withdrawArg, accountB.address] as [bigint, string];
                await expect(
                    iexecPocoAsAccountA.withdrawTo(...withdrawToArgs),
                ).to.be.revertedWithoutReason();
            });

            it('Should not withdraw To native tokens with insufficient balance', async () => {
                await iexecPocoAsAccountA.deposit(...depositArgs);
                const withdrawToArgs = [...withdrawArg, accountB.address] as [bigint, string];
                await expect(
                    iexecPocoAsAccountA.withdrawTo(withdrawToArgs[0] * 2n, withdrawToArgs[1]),
                ).to.be.revertedWithoutReason();
            });
        });

        describe('Recover', () => {
            it('Should recover from balance deviation', async () => {
                await iexecAdmin.sendTransaction({
                    to: proxyAddress,
                    value: nativeDepositAmount,
                });
                const initTotalSupply = await iexecPoco.totalSupply();
                expect(initTotalSupply).to.equal(depositAmount);

                const expectedDelta = 5n;
                await setStorageAt(
                    proxyAddress,
                    getPocoStorageSlotLocation(7n), // 7 is the slot index of `m_totalSupply` in Store
                    ethers.toBeHex(initTotalSupply - expectedDelta),
                );
                expect(await iexecPoco.totalSupply()).to.equal(
                    ethers.toBeHex(initTotalSupply - expectedDelta),
                );

                expect(await iexecPocoAsAdmin.recover.staticCall()).to.equal(expectedDelta);
                await expect(iexecPocoAsAdmin.recover())
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(AddressZero, iexecAdmin.address, expectedDelta);

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

function getTotalAmount(amounts: bigint[]) {
    return amounts.reduce((a, b) => a + b, 0n);
}

function toNativeAmount(depositAmount: bigint) {
    return ethers.parseUnits(depositAmount.toString(), 9);
}
