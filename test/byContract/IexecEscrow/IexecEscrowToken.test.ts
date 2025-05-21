// SPDX-FileCopyrightText: 2024-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    IexecInterfaceToken,
    IexecInterfaceToken__factory,
    RLC,
    RLC__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { setZeroAddressBalance } from '../../utils/utils';

const amount = ethers.parseUnits('100', 9);

describe('IexecEscrowToken', () => {
    let proxyAddress: string;
    let [iexecPoco, , iexecPocoAsAccountA, iexecPocoAsAdmin]: IexecInterfaceToken[] = [];
    let [iexecAdmin, accountA, accountB, accountC, anyone]: SignerWithAddress[] = [];
    let [rlcInstance, rlcInstanceAsAccountA]: RLC[] = [];

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            iexecAdmin,
            anyone: accountA,
            requester: accountB,
            sponsor: accountC,
            anyone,
        } = accounts);

        iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, anyone);
        iexecPocoAsAccountA = iexecPoco.connect(accountA);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
        rlcInstance = RLC__factory.connect(await iexecPoco.token(), anyone);
        rlcInstanceAsAccountA = rlcInstance.connect(accountA);
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(accountA.address, amount * 10n) //enough to cover tests.
            .then((tx) => tx.wait());
    }

    describe('Receive and Fallback', () => {
        it('Should revert on receive', async () => {
            await expect(
                accountA.sendTransaction({
                    to: proxyAddress,
                    value: amount,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
        it('Should revert on fallback', async () => {
            const randomData = ethers.hexlify(
                ethers.toUtf8Bytes((Math.random() * 0xfffff).toString(16)),
            );
            await expect(
                accountA.sendTransaction({
                    to: proxyAddress,
                    value: amount,
                    data: randomData,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
    });

    describe('Deposit', () => {
        it('Should deposit tokens', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            expect(await iexecPocoAsAccountA.deposit.staticCall(amount)).to.be.true;
            const tx = iexecPocoAsAccountA.deposit(amount);
            await expect(tx).to.changeTokenBalances(
                rlcInstance,
                [accountA, iexecPoco],
                [-amount, amount],
            );
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, amount);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [amount]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, amount);
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + amount);
        });
        it('Should deposit 0 token', async () => {
            expect(await iexecPocoAsAccountA.deposit.staticCall(0)).to.be.true;
            const tx = iexecPocoAsAccountA.deposit(0);
            await expect(tx).to.changeTokenBalances(rlcInstance, [accountA, iexecPoco], [-0, 0]);
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, 0);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [0]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, 0);
        });
        it('Should not deposit tokens when spending is not approved', async () => {
            await expect(iexecPocoAsAccountA.deposit(amount)).to.be.revertedWithoutReason();
        });
        it('Should not deposit tokens when caller is address 0', async () => {
            const addressZeroSigner = await ethers.getImpersonatedSigner(AddressZero);
            await setZeroAddressBalance();
            await rlcInstance
                .connect(iexecAdmin)
                .transfer(addressZeroSigner.address, amount)
                .then((tx) => tx.wait());
            // send some gas token
            iexecAdmin
                .sendTransaction({
                    to: addressZeroSigner.address,
                    value: ethers.parseUnits('100000', 9),
                })
                .then((tx) => tx.wait());

            await rlcInstance
                .connect(addressZeroSigner)
                .approve(proxyAddress, amount)
                .then((tx) => tx.wait());

            await expect(iexecPoco.connect(addressZeroSigner).deposit(amount)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for', () => {
        it('Should deposit tokens for another account', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            const depositForParams = {
                amount: amount,
                target: accountB.address,
            };
            const depositForArgs = Object.values(depositForParams) as [bigint, string];

            expect(await iexecPocoAsAccountA.depositFor.staticCall(...depositForArgs)).to.be.true;
            const tx = iexecPocoAsAccountA.depositFor(...depositForArgs);
            await expect(tx).to.changeTokenBalances(
                rlcInstance,
                [accountA, iexecPoco],
                [-depositForParams.amount, depositForParams.amount],
            );
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositForParams.amount);
            await expect(tx).to.changeTokenBalances(
                iexecPoco,
                [depositForParams.target],
                [depositForParams.amount],
            );
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, depositForParams.target, depositForParams.amount);
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply + depositForParams.amount,
            );
        });
        it('Should not deposit tokens for another account when spending is not approved', async () => {
            await expect(
                iexecPocoAsAccountA.depositFor(amount, accountB.address),
            ).to.be.revertedWithoutReason();
        });
        it('Should not deposit tokens for zero address', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            await expect(iexecPocoAsAccountA.depositFor(amount, AddressZero)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for array', () => {
        it('Should deposit tokens for multiple accounts', async () => {
            const depositForArrayParams = {
                amounts: [amount, amount * 2n],
                targets: [accountB.address, accountC.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                bigint[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);
            const initialTotalSupply = await iexecPoco.totalSupply();

            await rlcInstanceAsAccountA
                .approve(proxyAddress, depositTotalAmount)
                .then((tx) => tx.wait());
            expect(await iexecPocoAsAccountA.depositForArray.staticCall(...depositForArrayArgs)).to
                .be.true;
            const tx = iexecPocoAsAccountA.depositForArray(...depositForArrayArgs);
            await expect(tx).to.changeTokenBalances(
                rlcInstance,
                [accountA, iexecPoco],
                [-depositTotalAmount, depositTotalAmount],
            );
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositForArrayParams.amounts[0]);
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositForArrayParams.amounts[1]);
            await expect(tx).to.changeTokenBalances(
                iexecPoco,
                [...depositForArrayParams.targets],
                [...depositForArrayParams.amounts],
            );
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(
                    AddressZero,
                    depositForArrayParams.targets[0],
                    depositForArrayParams.amounts[0],
                );
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(
                    AddressZero,
                    depositForArrayParams.targets[1],
                    depositForArrayParams.amounts[1],
                );
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + depositTotalAmount);
        });
        it('Should not deposit tokens for multiple accounts with mismatched array lengths', async () => {
            const depositForArrayParams = {
                amounts: [amount * 2n, amount, amount / 2n],
                targets: [accountB.address, accountC.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                bigint[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

            await rlcInstanceAsAccountA
                .approve(proxyAddress, depositTotalAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
            ).to.be.revertedWith('invalid-array-length');
        });
        it('Should not deposit tokens for multiple accounts with address zero in target', async () => {
            const depositForArrayParams = {
                amounts: [amount, amount * 2n],
                targets: [AddressZero, accountB.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                bigint[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

            await rlcInstanceAsAccountA
                .approve(proxyAddress, depositTotalAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
            ).to.be.revertedWith('ERC20: mint to the zero address');
        });
    });

    describe('Withdraw', () => {
        it('Should withdraw tokens', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            expect(await iexecPocoAsAccountA.withdraw.staticCall(amount)).to.be.true;
            const tx = iexecPocoAsAccountA.withdraw(amount);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-amount]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, amount);
            await expect(tx).to.changeTokenBalances(
                rlcInstance,
                [iexecPoco, accountA],
                [-amount, amount],
            );
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(proxyAddress, accountA.address, amount);
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply - amount);
        });
        it('Should withdraw zero token', async () => {
            expect(await iexecPocoAsAccountA.withdraw.staticCall(0)).to.be.true;
            const tx = iexecPocoAsAccountA.withdraw(0);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-0]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
            await expect(tx).to.changeTokenBalances(rlcInstance, [iexecPoco, accountA], [-0, 0]);
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(proxyAddress, accountA.address, 0);
        });
        it('Should not withdraw native tokens with empty balance', async () => {
            await expect(iexecPocoAsAccountA.withdraw(amount)).to.be.revertedWithoutReason();
        });
        it('Should not withdraw tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());

            await expect(iexecPocoAsAccountA.withdraw(amount + 1n)).to.be.revertedWithoutReason();
        });
    });

    describe('Withdraw to', () => {
        it('Should withdraw to another address', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            const withdrawToParams = {
                amount: amount,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [bigint, string];

            expect(await iexecPocoAsAccountA.withdrawTo.staticCall(...withdrawToArgs)).to.be.true;
            const tx = iexecPocoAsAccountA.withdrawTo(...withdrawToArgs);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-amount]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawToParams.amount);
            await expect(tx).to.changeTokenBalances(
                rlcInstance,
                [iexecPoco, withdrawToParams.target],
                [-withdrawToParams.amount, withdrawToParams.amount],
            );
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(proxyAddress, withdrawToParams.target, withdrawToParams.amount);
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply - withdrawToParams.amount,
            );
        });
        it('Should withdraw to another address with zero token', async () => {
            const withdrawToParams = {
                amount: 0,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [bigint, string];

            expect(await iexecPocoAsAccountA.withdrawTo.staticCall(...withdrawToArgs)).to.be.true;
            const tx = iexecPocoAsAccountA.withdrawTo(...withdrawToArgs);
            await expect(tx).to.changeTokenBalances(iexecPoco, [accountA], [-0]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
            await expect(tx).to.changeTokenBalances(rlcInstance, [iexecPoco, accountB], [-0, 0]);
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(proxyAddress, withdrawToParams.target, 0);
        });
        it('Should not withdraw to another address with empty balance', async () => {
            await expect(
                iexecPocoAsAccountA.withdrawTo(amount, accountB.address),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw to another address with insufficient balance', async () => {
            await rlcInstanceAsAccountA.approve(proxyAddress, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());

            await expect(
                iexecPocoAsAccountA.withdrawTo(amount + 1n, accountB.address),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Recover', () => {
        it('Should recover from balance deviation', async () => {
            await rlcInstance.connect(iexecAdmin).transfer(proxyAddress, amount); // Simulate deviation

            const initTotalSupply = await iexecPoco.totalSupply();
            const expectedDelta = amount;
            const tx = iexecPocoAsAdmin.recover();
            await expect(tx).to.changeTokenBalances(iexecPoco, [iexecAdmin], [expectedDelta]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, iexecAdmin.address, expectedDelta);
            expect(await iexecPoco.totalSupply()).to.equal(initTotalSupply + expectedDelta);
        });
        it('Should recover 0 token when balance matches total supply', async () => {
            const initialSupply = await iexecPoco.totalSupply();
            const tx = iexecPocoAsAdmin.recover();
            await expect(tx).to.changeTokenBalances(iexecPoco, [iexecAdmin], [0]);
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, iexecAdmin.address, 0);
            expect(await iexecPoco.totalSupply()).to.equal(initialSupply);
        });
        it('Should not recover token when caller is not the owner', async () => {
            await expect(iexecPocoAsAccountA.recover()).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });
});

function getTotalAmount(amounts: bigint[]) {
    return amounts.reduce((a, b) => a + b, 0n);
}
