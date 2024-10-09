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

const standardAmount = AmountWithDecimals(BigNumber.from(100));
const depositParams = {
    amount: standardAmount,
};
const depositArgs = Object.values(depositParams) as [BigNumber];
const withdrawParams = {
    amount: standardAmount,
};
const withdrawArgs = Object.values(withdrawParams) as [BigNumber];

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
                    value: standardAmount,
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
                    value: standardAmount,
                    data: randomData,
                }),
            ).to.be.revertedWith('fallback-disabled');
        });
    });

    describe('Deposit', () => {
        it('Should deposit tokens', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());

            expect(await iexecPocoAsAccountA.callStatic.deposit(...depositArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.deposit(...depositArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [accountA, iexecPoco],
                    [-depositParams.amount, depositParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(accountA.address, iexecPoco, depositParams.amount)
                .to.changeTokenBalances(iexecPoco, [accountA], [depositParams.amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, accountA.address, depositParams.amount);
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
            const AddressZeroSigner = await ethers.getImpersonatedSigner(AddressZero);
            await rlcInstance
                .connect(iexecAdmin)
                .transfer(AddressZeroSigner.address, standardAmount)
                .then((tx) => tx.wait());
            // send some gas token
            iexecAdmin
                .sendTransaction({
                    to: AddressZeroSigner.address,
                    value: AmountWithDecimals(BigNumber.from(100_000)),
                })
                .then((tx) => tx.wait());

            const rlcInstanceAsAddress0 = rlcInstance.connect(AddressZeroSigner);
            await rlcInstanceAsAddress0
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());

            const iexecPocoAsAddress0 = iexecPoco.connect(AddressZeroSigner);
            await expect(iexecPocoAsAddress0.deposit(...depositArgs)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for', () => {
        it('Should deposit tokens for another account', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, standardAmount)
                .then((tx) => tx.wait());

            const depositForParams = {
                amount: standardAmount,
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
                    [depositParams.amount],
                )
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, depositForParams.target, depositForParams.amount);
        });
        it('Should not deposit tokens for zero address', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, standardAmount)
                .then((tx) => tx.wait());

            const depositForParams = {
                amount: standardAmount,
                target: AddressZero,
            };
            const depositForArgs = Object.values(depositForParams) as [BigNumber, string];
            await expect(iexecPocoAsAccountA.depositFor(...depositForArgs)).to.be.revertedWith(
                'ERC20: mint to the zero address',
            );
        });
    });

    describe('Deposit for array', () => {
        it('Should deposit tokens for multiple accounts', async () => {
            const depositForArrayParams = {
                amounts: [standardAmount, standardAmount.mul(2)],
                targets: [iexecAdmin.address, accountB.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                BigNumber[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

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
        });
        it('Should not depositForArray with mismatched array lengths', async () => {
            const depositForArrayParams = {
                amounts: [standardAmount.mul(2), standardAmount, standardAmount.div(2)],
                targets: [iexecAdmin.address, accountB.address],
            };
            const depositForArrayArgs = Object.values(depositForArrayParams) as [
                BigNumber[],
                string[],
            ];
            const depositTotalAmount = getTotalAmount(depositForArrayParams.amounts);

            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositTotalAmount)
                .then((tx) => tx.wait());
            const targets = [iexecAdmin.address, accountB.address];
            await expect(
                iexecPocoAsAccountA.depositForArray(...depositForArrayArgs),
            ).to.be.revertedWith('invalid-array-length');
        });
        it('Should not depositForArray with address zero in target', async () => {
            const depositForArrayParams = {
                amounts: [standardAmount, standardAmount.mul(2)],
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
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(...depositArgs).then((tx) => tx.wait());

            expect(await iexecPocoAsAccountA.callStatic.withdraw(...withdrawArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(...withdrawArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [iexecPoco, accountA],
                    [-withdrawParams.amount, withdrawParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco, accountA.address, withdrawParams.amount)
                .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawParams.amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawParams.amount);
        });
        it('Should withdraw zero token', async () => {
            expect(await iexecPocoAsAccountA.callStatic.withdraw(0)).to.be.true;
            await expect(iexecPocoAsAccountA.withdraw(0))
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountA], [-0, 0])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco, accountA.address, 0)
                .to.changeTokenBalances(iexecPoco, [accountA], [-0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
        });
        it('Should not withdraw native tokens with empty balance', async () => {
            await expect(
                iexecPocoAsAccountA.withdraw(...withdrawArgs),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(...depositArgs).then((tx) => tx.wait());

            await expect(
                iexecPocoAsAccountA.withdraw(depositParams.amount.mul(2)),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Withdraw to', () => {
        it('Should withdraw another address', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(...depositArgs).then((tx) => tx.wait());

            const withdrawToParams = {
                amount: withdrawParams.amount,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            expect(await iexecPocoAsAccountA.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(...withdrawToArgs))
                .to.changeTokenBalances(
                    rlcInstance,
                    [iexecPoco, accountB],
                    [-withdrawToParams.amount, withdrawToParams.amount],
                )
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco, withdrawToParams.target, withdrawToParams.amount)
                .to.changeTokenBalances(iexecPoco, [accountA], [-withdrawParams.amount])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, withdrawToParams.amount);
        });
        it('Should withdraw To with zero token', async () => {
            const withdrawToParams = {
                amount: 0,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            expect(await iexecPocoAsAccountA.callStatic.withdrawTo(...withdrawToArgs)).to.be.true;
            await expect(iexecPocoAsAccountA.withdrawTo(...withdrawToArgs))
                .to.changeTokenBalances(rlcInstance, [iexecPoco, accountB], [-0, 0])
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(iexecPoco, withdrawToParams.target, 0)
                .to.changeTokenBalances(iexecPoco, [accountA], [-0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(accountA.address, AddressZero, 0);
        });
        it('Should not withdraw To tokens with empty balance', async () => {
            const withdrawToParams = {
                amount: withdrawParams.amount,
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            await expect(
                iexecPocoAsAccountA.withdrawTo(...withdrawToArgs),
            ).to.be.revertedWithoutReason();
        });
        it('Should not withdraw To tokens with insufficient balance', async () => {
            await rlcInstanceAsAccountA
                .approve(iexecPoco.address, depositParams.amount)
                .then((tx) => tx.wait());
            await iexecPocoAsAccountA.deposit(...depositArgs).then((tx) => tx.wait());

            const withdrawToParams = {
                amount: depositParams.amount.mul(2),
                target: accountB.address,
            };
            const withdrawToArgs = Object.values(withdrawToParams) as [BigNumber, string];

            await expect(
                iexecPocoAsAccountA.withdrawTo(...withdrawToArgs),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Recover', () => {
        it('Should recover from balance deviation', async () => {
            await rlcInstance.connect(iexecAdmin).transfer(proxyAddress, standardAmount); // Simulate deviation

            const initTotalSupply = await iexecPoco.totalSupply();
            const expectedDelta = standardAmount;

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
                .approve(iexecPoco.address, standardAmount)
                .then((tx) => tx.wait());

            const receiveApprovalParams = {
                sender: accountA.address,
                amount: standardAmount,
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
        });
        it('Should receiveApproval for another sender', async () => {
            await rlcInstance
                .connect(iexecAdmin)
                .transfer(accountB.address, standardAmount)
                .then((tx) => tx.wait());
            await rlcInstance
                .connect(accountB)
                .approve(iexecPoco.address, standardAmount)
                .then((tx) => tx.wait());

            const receiveApprovalParams = {
                sender: accountB.address,
                amount: standardAmount,
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
                    [accountB, iexecPoco],
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
                    standardAmount,
                    ethers.Wallet.createRandom().address,
                    '0x',
                ),
            ).to.be.revertedWith('wrong-token');
        });
    });
});

function AmountWithDecimals(amount: BigNumber) {
    return ethers.utils.parseUnits(amount.toString(), 9);
}
function getTotalAmount(amounts: BigNumber[]) {
    return amounts.reduce((a, b) => a.add(b), BigNumber.from(0));
}
