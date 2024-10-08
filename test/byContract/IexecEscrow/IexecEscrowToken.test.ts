// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceToken,
    IexecInterfaceToken__factory,
    RLC,
    RLC__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const depositAmount = AmountWithDecimals(BigNumber.from(100));
const depositArgs = [depositAmount] as [BigNumber];
const withdrawAmount = BigNumber.from(100);

describe('IexecEscrowTokenDelegate', () => {
    let proxyAddress: string;
    let [iexecPoco, , iexecPocoAsAccountA, iexecPocoAsAdmin]: IexecInterfaceToken[] = [];
    let [iexecAdmin, accountA, accountB, anyone]: SignerWithAddress[] = [];
    let [rlcInstance, rlcInstanceAsAccountA]: RLC[] = [];

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, anyone: accountA, requester: accountB, anyone } = accounts);

        iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, anyone);
        iexecPocoAsAccountA = iexecPoco.connect(accountA);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
        rlcInstance = await RLC__factory.connect(await iexecPoco.token(), anyone);
        rlcInstanceAsAccountA = rlcInstance.connect(accountA);
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(accountA.address, AmountWithDecimals(BigNumber.from(10_000)))
            .then((tx) => tx.wait());
    }

    describe('Receive and Fallback', () => {
        it('Should revert on receive', async () => {
            await expect(
                accountA.sendTransaction({
                    to: iexecPoco.address,
                    value: depositAmount,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
        it('Should revert on fallback', async () => {
            const randomData = ethers.utils.hexlify(
                ethers.utils.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
            );
            await expect(
                accountA.sendTransaction({
                    to: iexecPoco.address,
                    value: depositAmount,
                    data: randomData,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
    });

    describe('Deposit', () => {
        it('Should deposit tokens', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());

            expect(await iexecPocoAsAccountA.callStatic.deposit(...depositArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.deposit(...depositArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositAmount, depositAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, depositAmount);
        });
        it('Should deposit 0 token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.deposit(0)).to.be.true;
            await expect(iexecPocoAsAccountA.deposit(0))
                .to.changeTokenBalances(rlcInstance, [accountA, iexecPoco], [-0, 0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, 0);
        });
        // it('Should not deposit tokens when caller is address 0', async () => {
        //     const AddressZeroSigner = await ethers.getSigner(AddressZero);
        //     await rlcInstance.connect(iexecAdmin).transfer(AddressZeroSigner.address,AmountWithDecimals(BigNumber.from(100))).then((tx) => tx.wait());
        //     const rlcInstanceAsAddress0 = rlcInstance.connect(AddressZeroSigner);
        //     // await rlcInstanceAsAddress0.approve(iexecPoco.address, depositAmount).then((tx) => tx.wait());
        //     const iexecPocoAsAddress0 = iexecPoco.connect(AddressZeroSigner);

        //     await expect(iexecPocoAsAddress0.deposit(...depositArgs))
        //         .to.be.revertedWith('ERC20: mint to the zero address');

        // });
    });

    describe('Deposit for', () => {
        it('Should deposit tokens for another account', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            expect(
                await iexecPocoAsAccountA.callStatic.depositFor(...depositArgs, accountB.address),
            ).to.be.true;
            await expect(iexecPocoAsAccountA.depositFor(...depositArgs, accountB.address))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositAmount, depositAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountB.address, depositAmount);
        });
        it('Should not deposit tokens for zero address', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.depositFor(depositAmount, AddressZero),
            ).to.be.revertedWith('ERC20: mint to the zero address');
        });
    });

    describe('Deposit for array', () => {
        it('Should deposit tokens for multiple accounts', async () => {
            const depositAmounts = [depositAmount, depositAmount.mul(2)];
            const accounts = [iexecAdmin.address, accountB.address];

            const depositTotalAmount = getTotalAmount(depositAmounts);
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());

            expect(await iexecPocoAsAccountA.callStatic.depositForArray(depositAmounts, accounts))
                .to.be.true;
            await expect(iexecPocoAsAccountA.depositForArray(depositAmounts, accounts))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositTotalAmount, depositTotalAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, iexecAdmin.address, depositAmount)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountB.address, depositAmount.mul(2));
        });
        it('Should not depositForArray with mismatched array lengths', async () => {
            const depositAmounts = [depositAmount.mul(2), depositAmount, depositAmount.div(2)];
            const depositTotalAmount = getTotalAmount(depositAmounts);

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            const targets = [iexecAdmin.address, accountB.address];
            await expect(
                iexecPocoAsAccountA.depositForArray(depositAmounts, targets),
            ).to.be.revertedWith('invalid-array-length');
        });
        it('Should not depositForArray with address zero in target', async () => {
            const depositAmounts = [depositAmount, depositAmount.mul(2)];

            const depositTotalAmount = getTotalAmount(depositAmounts);

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            const targets = [AddressZero, accountB.address];
            await expect(
                iexecPocoAsAccountA.depositForArray(depositAmounts, targets),
            ).to.be.revertedWith('ERC20: mint to the zero address');
        });
    });

    describe('Withdraw', () => {
        it('Should withdraw tokens', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(depositAmount).then((tx) => tx.wait());

            expect(await iexecPocoAsAccountA.callStatic.withdraw(withdrawAmount)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(withdrawAmount))
                .to.changeTokenBalances(
                    rlcInstance,
                    [iexecPoco, accountA],
                    [-withdrawAmount, withdrawAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawAmount);
        });
        it('Should withdraw zero token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.withdraw(0)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(0))
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountA], [-0, 0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
        });
        it('Should not withdraw native tokens with empty balance', async () => {
            await expect(
                iexecPocoAsAccountA.withdraw(withdrawAmount),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(depositAmount).then((tx) => tx.wait());

            await expect(
                iexecPocoAsAccountA.withdraw(depositAmount.mul(2)),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Withdraw to', () => {
        it('Should withdraw another address', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(depositAmount).then((tx) => tx.wait());

            expect(
                await iexecPocoAsAccountA.callStatic.withdrawTo(withdrawAmount, accountB.address),
            ).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(withdrawAmount, accountB.address))
                .to.changeTokenBalances(
                    rlcInstance,
                    [iexecPoco, accountB],
                    [-withdrawAmount, withdrawAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawAmount);
        });
        it('Should withdraw To with zero token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.withdrawTo(0, accountB.address)).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(0, accountB.address))
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountB], [-0, 0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
        });
        it('Should not withdraw To tokens with empty balance', async () => {
            await expect(
                iexecPocoAsAccountA.withdrawTo(withdrawAmount, accountB.address),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw To tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(depositAmount).then((tx) => tx.wait());

            await expect(
                iexecPocoAsAccountA.withdrawTo(depositAmount.mul(2), accountB.address),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Recover', () => {
        it('Should recover from balance deviation', async () => {
            await rlcInstance.connect(iexecAdmin).transfer(proxyAddress, depositAmount); // Simulate deviation

            const initTotalSupply = await iexecPoco.totalSupply();
            const expectedDelta = depositAmount;

            await expect(iexecPocoAsAdmin.recover())
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, iexecAdmin.address, expectedDelta);

            expect(await iexecPoco.totalSupply()).to.equal(initTotalSupply.add(expectedDelta));
        });
        it('Should recover 0 token when balance matches total supply', async () => {
            const initialSupply = await iexecPoco.totalSupply();

            await expect(iexecPocoAsAdmin.recover())
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, iexecAdmin.address, 0);
            expect(await iexecPoco.totalSupply()).to.equal(initialSupply);
        });
        it('Should not allow non-owner to recover', async () => {
            await expect(iexecPocoAsAccountA.recover()).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });

    describe('receiveApproval', () => {
        it('Should receiveApproval', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            expect(
                await iexecPocoAsAccountA.callStatic.receiveApproval(
                    accountA.address,
                    depositAmount,
                    rlcInstance.address,
                    '0x',
                ),
            ).to.be.true;
            await expect(
                iexecPocoAsAccountA.receiveApproval(
                    accountA.address,
                    depositAmount,
                    rlcInstance.address,
                    '0x',
                ),
            )
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositAmount, depositAmount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, depositAmount);
        });

        it('Should not receiveApproval when the wrong token is used', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.receiveApproval(
                    accountA.address,
                    depositAmount,
                    ethers.Wallet.createRandom().address,
                    '0x',
                ),
            ).to.be.revertedWith('wrong-token');
        });
    });
});

function AmountWithDecimals(depositAmount: BigNumber) {
    return ethers.utils.parseUnits(depositAmount.toString(), 9);
}
function getTotalAmount(amounts: BigNumber[]) {
    return amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
}
