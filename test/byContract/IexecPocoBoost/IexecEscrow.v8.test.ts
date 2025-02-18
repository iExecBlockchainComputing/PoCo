// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { HashZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { IexecEscrowTestContract, IexecEscrowTestContract__factory } from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';

const accountBalance = 1000;
const amount = 3;

let iexecEscrow: IexecEscrowTestContract;
let iexecEscrowAddress: string;
let account: SignerWithAddress;

describe('IexecEscrow.v8', function () {
    beforeEach('Deploy', async () => {
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        account = (await getIexecAccounts()).anyone;
        // Deploy test contract to make internal escrow functions accessible.
        iexecEscrow = await new IexecEscrowTestContract__factory()
            .connect(account) // Anyone works.
            .deploy()
            .then((contract) => contract.waitForDeployment());
        iexecEscrowAddress = await iexecEscrow.getAddress();
        // Initialize account with some funds.
        await iexecEscrow.setBalance(account.address, accountBalance).then((tx) => tx.wait());
    }

    describe('Lock', function () {
        it('Should lock funds', async function () {
            const frozenBefore = Number(await iexecEscrow.frozenOf(account.address));
            const tx = await iexecEscrow.lock_(account.address, amount);
            await expect(tx).to.changeTokenBalances(
                iexecEscrow,
                [iexecEscrowAddress, account.address],
                [amount, -amount],
            );
            await expect(tx)
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(account.address, iexecEscrowAddress, amount)
                .to.emit(iexecEscrow, 'Lock')
                .withArgs(account.address, amount);
            expect(await iexecEscrow.frozenOf(account.address)).to.equal(frozenBefore + amount);
        });

        it('Should not lock funds for empty address', async function () {
            await expect(iexecEscrow.lock_(ZeroAddress, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer from empty address',
            );
        });

        it('Should not lock funds when insufficient balance', async function () {
            await expect(iexecEscrow.lock_(account.address, accountBalance + 1)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Unlock', function () {
        it('Should unlock funds', async function () {
            // Lock some funds to be able to unlock.
            await iexecEscrow.lock_(account.address, accountBalance).then((tx) => tx.wait());

            const frozenBefore = Number(await iexecEscrow.frozenOf(account.address));
            const tx = await iexecEscrow.unlock_(account.address, amount);
            await expect(tx).to.changeTokenBalances(
                iexecEscrow,
                [iexecEscrowAddress, account.address],
                [-amount, amount],
            );
            await expect(tx)
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrowAddress, account.address, amount)
                .to.emit(iexecEscrow, 'Unlock')
                .withArgs(account.address, amount);
            expect(await iexecEscrow.frozenOf(account.address)).to.equal(frozenBefore - amount);
        });

        it('Should not unlock funds for empty address', async function () {
            await expect(iexecEscrow.unlock_(ZeroAddress, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not unlock funds when insufficient balance', async function () {
            await expect(iexecEscrow.unlock_(account.address, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Reward', function () {
        it('Should reward', async function () {
            // Fund iexecEscrow so it can reward.
            await iexecEscrow.setBalance(iexecEscrowAddress, amount).then((tx) => tx.wait());

            const tx = await iexecEscrow.reward_(account.address, amount, HashZero);
            await expect(tx).to.changeTokenBalances(
                iexecEscrow,
                [iexecEscrowAddress, account.address],
                [-amount, amount],
            );
            await expect(tx)
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrowAddress, account.address, amount)
                .to.emit(iexecEscrow, 'Reward')
                .withArgs(account.address, amount, HashZero);
        });

        it('Should not reward empty address', async function () {
            await expect(iexecEscrow.reward_(ZeroAddress, amount, HashZero)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not reward when insufficient balance', async function () {
            await expect(iexecEscrow.reward_(account.address, amount, HashZero)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Seize', function () {
        it('Should seize funds', async function () {
            // Lock some funds to be able to seize.
            await iexecEscrow.lock_(account.address, accountBalance).then((tx) => tx.wait());

            const frozenBefore = Number(await iexecEscrow.frozenOf(account.address));
            const tx = await iexecEscrow.seize_(account.address, amount, HashZero);
            await expect(tx).to.changeTokenBalances(
                iexecEscrow,
                [iexecEscrowAddress, account.address],
                [0, 0],
            );
            await expect(tx)
                .to.emit(iexecEscrow, 'Seize')
                .withArgs(account.address, amount, HashZero);
            expect(await iexecEscrow.frozenOf(account.address)).to.equal(frozenBefore - amount);
        });

        it('Should not seize funds for empty address', async function () {
            await expect(iexecEscrow.seize_(ZeroAddress, amount, HashZero)).to.be.revertedWithPanic(
                0x11,
            );
        });

        it('Should not seize funds when insufficient balance', async function () {
            await expect(
                iexecEscrow.seize_(account.address, amount, HashZero),
            ).to.be.revertedWithPanic(0x11);
        });
    });
});
