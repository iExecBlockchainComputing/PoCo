// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
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

const amount = ethers.utils.parseUnits(BigNumber.from(100).toString(), 9);

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
            .transfer(accountA.address, amount.mul(10)) //enough to cover tests.
            .then((tx) => tx.wait());
    }

    describe('Receive and Fallback', () => {
        it('Should revert on receive', async () => {
            await expect(
                accountA.sendTransaction({
                    to: iexecPoco.address,
                    value: amount,
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
                    value: amount,
                    data: randomData,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
    });

    describe('Deposit', () => {
        it('Should deposit tokens', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            expect(await iexecPocoAsAccountA.callStatic.deposit(amount)).to.be.true;
            await expect(iexecPocoAsAccountA.deposit(amount))
                .to.changeTokenBalances(rlcInstance, [accountA, iexecPoco], [-amount, amount])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, amount)
                .to.changeTokenBalances(iexecPoco, [accountA], [amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, amount);
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply.add(amount));
        });
        it('Should deposit 0 token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.deposit(0)).to.be.true;
            await expect(iexecPocoAsAccountA.deposit(0))
                .to.changeTokenBalances(rlcInstance, [accountA, iexecPoco], [-0, 0])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, 0)
                .to.changeTokenBalances(iexecPoco, [accountA], [0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, 0);
        });
        it('Should not deposit tokens when caller is address 0', async () => {
            const addressZeroSigner = await ethers.getImpersonatedSigner(AddressZero);
            await rlcInstance
                .connect(iexecAdmin)
                .transfer(addressZeroSigner.address, amount)
                .then((tx) => tx.wait());
            // send some gas token
            iexecAdmin
                .sendTransaction({
                    to: addressZeroSigner.address,
                    value: ethers.utils.parseUnits(BigNumber.from(100_000).toString(), 9),
                })
                .then((tx) => tx.wait());

            await rlcInstance
                .connect(addressZeroSigner)
                .approve(iexecPoco.address, amount)
                .then((tx) => tx.wait());

            await expect(iexecPoco.connect(addressZeroSigner).deposit(amount)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for', () => {
        it('Should deposit tokens for another account', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            const depositForParams = {
                amount: amount,
                target: accountB.address,
            };
            const depositForArgs = Object.values(depositForParams) as [BigNumber, string];

            expect(await iexecPocoAsAccountA.callStatic.depositFor(...depositForArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.depositFor(...depositForArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositForParams.amount, depositForParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositForParams.amount)
                .to.changeTokenBalances(
                    iexecPoco,
                    [depositForParams.target],
                    [depositForParams.amount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, depositForParams.target, depositForParams.amount);
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply.add(depositForParams.amount),
            );
        });
        it('Should not deposit tokens for zero address', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            await expect(iexecPocoAsAccountA.depositFor(amount, AddressZero)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for array', () => {
        it('Should deposit tokens for multiple accounts', async () => {
            const depositForArrayParams = {
                amounts: [amount, amount.mul(2)],
                targets: [accountB.address, accountC.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                BigNumber[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);
            const initialTotalSupply = await iexecPoco.totalSupply();

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            expect(await iexecPocoAsAccountA.callStatic.depositForArray(...depositForArrayArgs)).to
                .be.true;
            await expect(iexecPocoAsAccountA.depositForArray(...depositForArrayArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositTotalAmount, depositTotalAmount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositTotalAmount)
                .to.changeTokenBalances(
                    iexecPoco,
                    [...depositForArrayParams.targets],
                    [...depositForArrayParams.amounts],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(
                    AddressZero,
                    depositForArrayParams.targets[0],
                    depositForArrayParams.amounts[0],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(
                    AddressZero,
                    depositForArrayParams.targets[1],
                    depositForArrayParams.amounts[1],
                );
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply.add(depositTotalAmount),
            );
        });
        it('Should not deposit tokens for multiple accounts with mismatched array lengths', async () => {
            const depositForArrayParams = {
                amounts: [amount.mul(2), amount, amount.div(2)],
                targets: [accountB.address, accountC.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                BigNumber[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
            ).to.be.revertedWith('invalid-array-length');
        });
        it('Should not deposit tokens for multiple accounts with address zero in target', async () => {
            const depositForArrayParams = {
                amounts: [amount, amount.mul(2)],
                targets: [AddressZero, accountB.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                BigNumber[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            await expect(
                iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
            ).to.be.revertedWith('ERC20: mint to the zero address');
        });
    });

    describe('Withdraw', () => {
        it('Should withdraw tokens', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            expect(await iexecPocoAsAccountA.callStatic.withdraw(amount)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(amount))
                .to.changeTokenBalances(iexecPoco, [accountA], [-amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, amount)
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountA], [-amount, amount])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco.address, accountA.address, amount);
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply.sub(amount));
        });
        it('Should withdraw zero token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.withdraw(0)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(0))
                .to.changeTokenBalances(iexecPoco, [accountA], [-0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0)
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountA], [-0, 0])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco.address, accountA.address, 0);
        });
        it('Should not withdraw native tokens with empty balance', async () => {
            await expect(iexecPocoAsAccountA.withdraw(amount)).to.be.revertedWithoutReason();
        });
        it('Should not withdraw tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());

            await expect(iexecPocoAsAccountA.withdraw(amount.add(1))).to.be.revertedWithoutReason();
        });
    });

    describe('Withdraw to', () => {
        it('Should withdraw to another address', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            const withdrawToParams = {
                amount: amount,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            expect(await iexecPocoAsAccountA.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(...withdrawToArgs))
                .to.changeTokenBalances(iexecPoco, [accountA], [-amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawToParams.amount)
                .to.changeTokenBalances(
                    rlcInstance,
                    [iexecPoco, withdrawToParams.target],
                    [-withdrawToParams.amount, withdrawToParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco.address, withdrawToParams.target, withdrawToParams.amount);
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply.sub(withdrawToParams.amount),
            );
        });
        it('Should withdraw to another address with zero token', async () => {
            const withdrawToParams = {
                amount: 0,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            expect(await iexecPocoAsAccountA.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(...withdrawToArgs))
                .to.changeTokenBalances(iexecPoco, [accountA], [-0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0)
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountB], [-0, 0])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco.address, withdrawToParams.target, 0);
        });
        it('Should not withdraw to another address with empty balance', async () => {
            await expect(
                iexecPocoAsAccountA.withdrawTo(amount, accountB.address),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw to another address with insufficient balance', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(amount).then((tx) => tx.wait());

            await expect(
                iexecPocoAsAccountA.withdrawTo(amount.add(1), accountB.address),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Recover', () => {
        it('Should recover from balance deviation', async () => {
            await rlcInstance.connect(iexecAdmin).transfer(proxyAddress, amount); // Simulate deviation

            const initTotalSupply = await iexecPoco.totalSupply();
            const expectedDelta = amount;

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
        it('Should not recover token when caller is not the owner', async () => {
            await expect(iexecPocoAsAccountA.recover()).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });

    describe('receiveApproval', () => {
        it('Should receiveApproval', async () => {
            await rlcInstanceAsAccountA.approve(iexecPoco.address, amount).then((tx) => tx.wait());
            const initialTotalSupply = await iexecPoco.totalSupply();

            const receiveApprovalParams = {
                sender: accountA.address,
                amount,
                token: rlcInstance.address,
                extraData: '0x',
            };
            const receiveApprovalArgs = Object.values(receiveApprovalParams) as [
                string,
                BigNumber,
                string,
                string,
            ];
            expect(await iexecPocoAsAccountA.callStatic.receiveApproval(...receiveApprovalArgs)).to
                .be.true;
            await expect(iexecPocoAsAccountA.receiveApproval(...receiveApprovalArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-receiveApprovalParams.amount, receiveApprovalParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, receiveApprovalParams.amount)
                .to.changeTokenBalances(iexecPoco, [accountA], [receiveApprovalParams.amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, receiveApprovalParams.sender, receiveApprovalParams.amount);
            expect(await iexecPoco.totalSupply()).to.equal(
                initialTotalSupply.add(receiveApprovalParams.amount),
            );
        });
        it('Should receiveApproval for another sender', async () => {
            await rlcInstance
                .connect(iexecAdmin)
                .transfer(accountB.address, amount)
                .then((tx) => tx.wait());
            await rlcInstance
                .connect(accountB)
                .approve(iexecPoco.address, amount)
                .then((tx) => tx.wait());

            const receiveApprovalParams = {
                sender: accountB.address,
                amount: amount,
                token: rlcInstance.address,
                extraData: '0x',
            };
            const receiveApprovalArgs = Object.values(receiveApprovalParams) as [
                string,
                BigNumber,
                string,
                string,
            ];
            expect(await iexecPocoAsAccountA.callStatic.receiveApproval(...receiveApprovalArgs)).to
                .be.true;
            await expect(iexecPocoAsAccountA.receiveApproval(...receiveApprovalArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [receiveApprovalParams.sender, iexecPoco],
                    [-receiveApprovalParams.amount, receiveApprovalParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(receiveApprovalParams.sender, iexecPoco, receiveApprovalParams.amount)
                .to.changeTokenBalances(
                    iexecPoco,
                    [receiveApprovalParams.sender],
                    [receiveApprovalParams.amount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, receiveApprovalParams.sender, receiveApprovalParams.amount);
        });
        it('Should not receiveApproval when the wrong token is used', async () => {
            await expect(
                iexecPocoAsAccountA.receiveApproval(
                    accountA.address,
                    amount,
                    ethers.Wallet.createRandom().address,
                    '0x',
                ),
            ).to.be.revertedWith('wrong-token');
        });
    });
});

function getTotalAmount(amounts: BigNumber[]) {
    return amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
}
