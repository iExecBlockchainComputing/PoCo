// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants } from 'ethers';
import { expect } from 'hardhat';
import { IexecEscrowTestContract, IexecEscrowTestContract__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const userBalance = 1000;
const amount = 3;
const ref = constants.HashZero; // TODO remove this and use HashZero

let iexecEscrow: IexecEscrowTestContract;
let user: SignerWithAddress;

describe('IexecEscrow.v8', function () {
    beforeEach('Deploy', async () => {
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        user = (await getIexecAccounts()).anyone;
        // Deploy test contract to make internal escrow functions accessible.
        iexecEscrow = await new IexecEscrowTestContract__factory()
            .connect(user) // Anyone works.
            .deploy()
            .then((contract) => contract.deployed());
        // Deposit some funds in the user's account.
        await iexecEscrow.setBalance(user.address, userBalance).then((tx) => tx.wait());
    }

    describe('Lock', function () {
        it('Should lock funds', async function () {
            const frozenBefore = (await iexecEscrow.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.lock_(user.address, amount))
                .to.changeTokenBalances(
                    iexecEscrow,
                    [iexecEscrow.address, user.address],
                    [amount, -amount],
                )
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(user.address, iexecEscrow.address, amount)
                .to.emit(iexecEscrow, 'Lock')
                .withArgs(user.address, amount);
            expect(await iexecEscrow.frozenOf(user.address)).to.equal(frozenBefore + amount);
        });

        it('Should not lock funds for empty address', async function () {
            await expect(iexecEscrow.lock_(constants.AddressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer from empty address',
            );
        });

        it('Should not lock funds when insufficient balance', async function () {
            await expect(iexecEscrow.lock_(user.address, userBalance + 1)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Unlock', function () {
        it('Should unlock funds', async function () {
            // Lock some user funds to be able to unlock.
            await iexecEscrow.lock_(user.address, userBalance).then((tx) => tx.wait());

            const frozenBefore = (await iexecEscrow.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.unlock_(user.address, amount))
                .to.changeTokenBalances(
                    iexecEscrow,
                    [iexecEscrow.address, user.address],
                    [-amount, amount],
                )
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrow.address, user.address, amount)
                .to.emit(iexecEscrow, 'Unlock')
                .withArgs(user.address, amount);
            expect(await iexecEscrow.frozenOf(user.address)).to.equal(frozenBefore - amount);
        });

        it('Should not unlock funds for empty address', async function () {
            await expect(iexecEscrow.unlock_(constants.AddressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not unlock funds when insufficient balance', async function () {
            await expect(iexecEscrow.unlock_(user.address, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Reward', function () {
        it('Should reward', async function () {
            // Fund iexecEscrow so it can reward the user.
            await iexecEscrow.setBalance(iexecEscrow.address, amount).then((tx) => tx.wait());

            await expect(iexecEscrow.reward_(user.address, amount, ref))
                .to.changeTokenBalances(
                    iexecEscrow,
                    [iexecEscrow.address, user.address],
                    [-amount, amount],
                )
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrow.address, user.address, amount)
                .to.emit(iexecEscrow, 'Reward')
                .withArgs(user.address, amount, ref);
        });

        it('Should not reward empty address', async function () {
            await expect(
                iexecEscrow.reward_(constants.AddressZero, amount, ref),
            ).to.be.revertedWith('IexecEscrow: Transfer to empty address');
        });

        it('Should not reward when insufficient balance', async function () {
            await expect(iexecEscrow.reward_(user.address, amount, ref)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Seize', function () {
        it('Should seize funds', async function () {
            // Lock some user funds to be able to seize.
            await iexecEscrow.lock_(user.address, userBalance).then((tx) => tx.wait());

            const frozenBefore = (await iexecEscrow.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.seize_(user.address, amount, ref))
                .to.changeTokenBalances(iexecEscrow, [iexecEscrow.address, user.address], [0, 0])
                .to.emit(iexecEscrow, 'Seize')
                .withArgs(user.address, amount, ref);
            expect(await iexecEscrow.frozenOf(user.address)).to.equal(frozenBefore - amount);
        });

        it('Should not seize funds for empty address', async function () {
            await expect(
                iexecEscrow.seize_(constants.AddressZero, amount, ref),
            ).to.be.revertedWithPanic(0x11);
        });

        it('Should not seize funds when insufficient balance', async function () {
            await expect(iexecEscrow.seize_(user.address, amount, ref)).to.be.revertedWithPanic(
                0x11,
            );
        });
    });
});
