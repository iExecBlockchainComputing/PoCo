// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import CONFIG from '../../../config/config.json';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const DEPOSIT_AMOUNT = 100;
const DEPOSIT_AMOUNT_ETHER = ethers.utils.parseUnits(DEPOSIT_AMOUNT.toString(), 9);

const ZERO_ADDRESS = ethers.constants.AddressZero;
if (CONFIG.chains.default.asset == 'Native')
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

        async function checkBalances(address: string, expectedBalance: number) {
            expect(await iexecPocoAsAnyone.balanceOf(address)).to.be.equal(expectedBalance);
        }

        it('Should call receive successfully', async () => {
            await checkBalances(anyone.address, 0);
            const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

            const tx = await anyone.sendTransaction({
                to: iexecPoco.address,
                value: DEPOSIT_AMOUNT_ETHER,
            });
            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [-DEPOSIT_AMOUNT_ETHER, DEPOSIT_AMOUNT_ETHER],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(ZERO_ADDRESS, anyone.address, DEPOSIT_AMOUNT);

            await checkBalances(anyone.address, DEPOSIT_AMOUNT);
            expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
                initialNativeBalance.sub(DEPOSIT_AMOUNT_ETHER),
            );
            expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                DEPOSIT_AMOUNT_ETHER,
            );
        });

        it('Should call fallback successfully', async () => {
            await checkBalances(anyone.address, 0);
            const initialNativeBalance = await ethers.provider.getBalance(anyone.address);
            const randomData = ethers.utils.hexlify(
                ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
            );

            const tx = await anyone.sendTransaction({
                to: iexecPoco.address,
                value: DEPOSIT_AMOUNT_ETHER,
                data: randomData,
            });
            await expect(tx)
                .to.changeEtherBalances(
                    [anyone, iexecPoco],
                    [-DEPOSIT_AMOUNT_ETHER, DEPOSIT_AMOUNT_ETHER],
                )
                .to.emit(iexecPocoAsAnyone, 'Transfer')
                .withArgs(ZERO_ADDRESS, anyone.address, DEPOSIT_AMOUNT);

            await checkBalances(anyone.address, DEPOSIT_AMOUNT);
            expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
                initialNativeBalance.sub(DEPOSIT_AMOUNT_ETHER),
            );
            expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                DEPOSIT_AMOUNT_ETHER,
            );
        });

        describe('Deposits', function () {
            it('Should deposit native tokens', async () => {
                await checkBalances(anyone.address, 0);
                const initialNativeBalance = await ethers.provider.getBalance(anyone.address);

                const tx = await iexecPocoAsAnyone.deposit({
                    value: DEPOSIT_AMOUNT_ETHER,
                });
                await expect(tx)
                    .to.changeEtherBalances(
                        [anyone, iexecPoco],
                        [-DEPOSIT_AMOUNT_ETHER, DEPOSIT_AMOUNT_ETHER],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(ZERO_ADDRESS, anyone.address, DEPOSIT_AMOUNT);

                await checkBalances(anyone.address, DEPOSIT_AMOUNT);
                expect(await ethers.provider.getBalance(anyone.address)).to.be.equal(
                    initialNativeBalance.sub(DEPOSIT_AMOUNT_ETHER),
                );
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    DEPOSIT_AMOUNT_ETHER,
                );
            });

            it('Should deposit native tokens for another address', async () => {
                await checkBalances(iexecAdmin.address, 0);
                await checkBalances(anyone.address, 0);

                const tx = await iexecPoco.depositFor(anyone.address, {
                    value: DEPOSIT_AMOUNT_ETHER,
                });
                await expect(tx)
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [-DEPOSIT_AMOUNT_ETHER, DEPOSIT_AMOUNT_ETHER],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(ZERO_ADDRESS, anyone.address, DEPOSIT_AMOUNT);

                await checkBalances(iexecAdmin.address, 0);
                await checkBalances(anyone.address, DEPOSIT_AMOUNT);
                expect(await ethers.provider.getBalance(iexecPoco.address)).to.equal(
                    DEPOSIT_AMOUNT_ETHER,
                );
            });

            it('Should depositForArray with exact value and good arrays lengths', async () => {
                const amounts = [200, 100];
                const totalAmount = amounts.reduce((a, b) => a + b, 0);
                const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
                const targets = [iexecAdmin.address, anyone.address];

                await checkBalances(iexecAdmin.address, 0);
                await checkBalances(anyone.address, 0);

                const tx = await iexecPoco.depositForArray(amounts, targets, {
                    value: nativeAmountSent,
                });
                await expect(tx)
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [-nativeAmountSent, nativeAmountSent],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(ZERO_ADDRESS, iexecAdmin.address, amounts[0])
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(ZERO_ADDRESS, anyone.address, amounts[1]);

                await checkBalances(iexecAdmin.address, amounts[0]);
                await checkBalances(anyone.address, amounts[1]);
            });

            it('Should depositForArray with good arrays lengths and excess native value sent', async () => {
                const amounts = [DEPOSIT_AMOUNT * 2, DEPOSIT_AMOUNT];
                const totalAmount = amounts.reduce((a, b) => a + b, 0);
                const excessAmount = DEPOSIT_AMOUNT;
                const excessAmountWei = ethers.utils.parseUnits(excessAmount.toString(), 9);
                const nativeAmountSent = ethers.utils.parseUnits(
                    (totalAmount + excessAmount).toString(),
                    9,
                );
                const targets = [iexecAdmin.address, anyone.address];

                await checkBalances(iexecAdmin.address, 0);
                const initialNativeBalance = await ethers.provider.getBalance(iexecAdmin.address);

                await checkBalances(anyone.address, 0);
                const tx = await iexecPoco.depositForArray(amounts, targets, {
                    value: nativeAmountSent,
                });

                await expect(tx)
                    .to.changeEtherBalances(
                        [iexecAdmin, iexecPoco],
                        [
                            -nativeAmountSent.sub(excessAmountWei),
                            nativeAmountSent.sub(excessAmountWei),
                        ],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(ZERO_ADDRESS, iexecAdmin.address, amounts[0]);

                await checkBalances(iexecAdmin.address, amounts[0]);
                expect(await ethers.provider.getBalance(iexecAdmin.address)).to.equal(
                    initialNativeBalance.sub(nativeAmountSent).add(excessAmountWei),
                );

                await checkBalances(anyone.address, amounts[1]);
            });

            it('Should not depositForArray when amounts.length != target.length', async () => {
                const amounts = [DEPOSIT_AMOUNT * 2, DEPOSIT_AMOUNT, DEPOSIT_AMOUNT / 2];
                const totalAmount = amounts.reduce((a, b, c) => a + b + c, 0);
                const nativeAmountSent = ethers.utils.parseUnits(totalAmount.toString(), 9);
                const targets = [iexecAdmin.address, anyone.address];
                await checkBalances(iexecAdmin.address, 0);
                await checkBalances(anyone.address, 0);

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
                    value: DEPOSIT_AMOUNT_ETHER,
                });

                const tx = await iexecPocoAsAnyone.withdraw(DEPOSIT_AMOUNT);
                await expect(tx)
                    .to.changeEtherBalances(
                        [anyone, iexecPoco],
                        [DEPOSIT_AMOUNT_ETHER, -DEPOSIT_AMOUNT_ETHER],
                    )
                    .to.emit(iexecPocoAsAnyone, 'Transfer')
                    .withArgs(anyone.address, ZERO_ADDRESS, DEPOSIT_AMOUNT);

                await checkBalances(anyone.address, 0);
            });

            it('Should withdraw native tokens to another address', async () => {
                await expect(
                    await iexecPoco.deposit({
                        value: DEPOSIT_AMOUNT_ETHER,
                    }),
                ).to.changeEtherBalances(
                    [iexecAdmin, iexecPoco],
                    [-DEPOSIT_AMOUNT_ETHER, DEPOSIT_AMOUNT_ETHER],
                );
                expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(
                    DEPOSIT_AMOUNT,
                );

                const tx = await iexecPoco.withdrawTo(DEPOSIT_AMOUNT, anyone.address);
                await expect(tx)
                    .to.changeEtherBalances(
                        [anyone, iexecPoco],
                        [DEPOSIT_AMOUNT_ETHER, -DEPOSIT_AMOUNT_ETHER],
                    )
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecAdmin.address, ZERO_ADDRESS, DEPOSIT_AMOUNT);

                expect(await iexecPocoAsAnyone.balanceOf(iexecAdmin.address)).to.be.equal(0);
            });

            it('Should not withdraw native tokens when balance is empty', async () => {
                await expect(
                    iexecPocoAsAnyone.withdraw(DEPOSIT_AMOUNT),
                ).to.be.revertedWithoutReason();
            });

            it('Should not withdraw native tokens when balance is insufficient', async () => {
                await iexecPocoAsAnyone.deposit({
                    value: DEPOSIT_AMOUNT_ETHER,
                });

                await expect(
                    iexecPocoAsAnyone.withdraw(DEPOSIT_AMOUNT * 2),
                ).to.be.revertedWithoutReason();
            });
        });
        describe('Recover', function () {
            it('Should recover extra balance', async () => {
                await iexecAdmin.sendTransaction({
                    to: iexecPoco.address,
                    value: DEPOSIT_AMOUNT_ETHER,
                });
                const delta = 0;
                const recoverTx = await iexecPoco.recover();
                await expect(recoverTx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(ZERO_ADDRESS, iexecAdmin.address, delta);
            });

            it('Should not recover extra balance when user is not allowed', async () => {
                await expect(iexecPocoAsAnyone.recover()).to.be.revertedWith(
                    'Ownable: caller is not the owner',
                );
            });
        });
    });
