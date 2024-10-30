// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants } from 'ethers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    ERC1538Update__factory,
    IexecEscrowTestContract,
    IexecEscrowTestContract__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
} from '../../../typechain';
import { deploy } from '../../../utils/deploy-tools';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { linkContractToProxy } from '../../../utils/proxy-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const userBalance = 1000;
const amount = 3;
const ref = constants.HashZero;

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecEscrow: IexecEscrowTestContract;
let [iexecAdmin, anyone]: SignerWithAddress[] = [];
let user: SignerWithAddress;

describe('IexecEscrow.v8', function () {
    beforeEach('Deploy', async () => {
        // // Get wallets.
        // [deployer, user] = await ethers.getSigners();
        // // Deploy the contract to be tested as a mock.
        // iexecEscrow = (await smock
        //     .mock<IexecEscrowTestContract__factory>('IexecEscrowTestContract')
        //     .then((instance) => instance.deploy())
        //     .then((contract) => contract.deployed())) as MockContract<IexecEscrowTestContract>;
        // // Set initial state of contract.
        // await iexecEscrow.setVariables({
        //     [BALANCES]: {
        //         [iexecEscrow.address]: initialEscrowBalance,
        //         [user.address]: initialUserBalance,
        //     },
        //     [FROZENS]: {
        //         [user.address]: initialUserFrozen,
        //     },
        // });

        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, anyone } = accounts);
        const iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        user = anyone;
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
        // Deploy test contract and link it to the proxy
        // to make internal escrow functions accessible.
        await deploy(new IexecEscrowTestContract__factory(), anyone, [], { quiet: true }).then(
            (contract) =>
                linkContractToProxy(
                    ERC1538Update__factory.connect(proxyAddress, iexecAdmin),
                    contract.address,
                    new IexecEscrowTestContract__factory(),
                ),
        );
        iexecEscrow = IexecEscrowTestContract__factory.connect(proxyAddress, user);
        // Deposit some funds in user's account.
        await iexecWrapper.depositInIexecAccount(user, userBalance);
    }

    describe('Lock', function () {
        it('Should lock funds', async function () {
            const frozenBefore = (await iexecPoco.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.lock_(user.address, amount))
                .to.changeTokenBalances(iexecPoco, [proxyAddress, user.address], [amount, -amount])
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(user.address, proxyAddress, amount)
                .to.emit(iexecEscrow, 'Lock')
                .withArgs(user.address, amount);
            expect(await iexecPoco.frozenOf(user.address)).to.equal(frozenBefore + amount);
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

            const frozenBefore = (await iexecPoco.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.unlock_(user.address, amount))
                .to.changeTokenBalances(iexecPoco, [proxyAddress, user.address], [-amount, amount])
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(proxyAddress, user.address, amount)
                .to.emit(iexecEscrow, 'Unlock')
                .withArgs(user.address, amount);
            expect(await iexecPoco.frozenOf(user.address)).to.equal(frozenBefore - amount);
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
            // Fund iexecPoco so it can reward the user.
            await iexecPoco
                .connect(user)
                .transfer(proxyAddress, amount)
                .then((tx) => tx.wait());

            await expect(iexecEscrow.reward_(user.address, amount, ref))
                .to.changeTokenBalances(iexecPoco, [proxyAddress, user.address], [-amount, amount])
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(proxyAddress, user.address, amount)
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

            const frozenBefore = (await iexecPoco.frozenOf(user.address)).toNumber();
            await expect(iexecEscrow.seize_(user.address, amount, ref))
                .to.changeTokenBalances(iexecPoco, [proxyAddress, user.address], [0, 0])
                .to.emit(iexecEscrow, 'Seize')
                .withArgs(user.address, amount, ref);
            expect(await iexecPoco.frozenOf(user.address)).to.equal(frozenBefore - amount);
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
