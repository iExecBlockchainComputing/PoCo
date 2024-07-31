// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    TestReceiver,
    TestReceiver__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const value = 100;
const zeroAddress = ethers.constants.AddressZero;

describe('Poco', async () => {
    let proxyAddress: string;
    let iexecWrapper: IexecWrapper;
    let [iexecPoco, iexecPocoAsHolder, iexecPocoAsSpender]: IexecInterfaceNative[] = [];
    let [holder, recipient, spender, anyone, zeroAddressSigner]: SignerWithAddress[] = [];
    let totalSupplyBeforeFirstDeposit: BigNumber;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        // Setup current test accounts from some arbitrary iExec accounts
        ({ requester: holder, beneficiary: recipient, anyone } = accounts);
        spender = recipient;
        zeroAddressSigner = await ethers.getImpersonatedSigner(zeroAddress);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsHolder = iexecPoco.connect(holder);
        iexecPocoAsSpender = iexecPoco.connect(spender);
        totalSupplyBeforeFirstDeposit = await iexecPoco.totalSupply();
        await iexecWrapper.depositInIexecAccount(holder, value);
    }

    describe('Total supply', () => {
        it('Should get total supply', async () => {
            expect(await iexecPoco.totalSupply()).equal(totalSupplyBeforeFirstDeposit.add(value));
        });
    });

    describe('Balance of', () => {
        it('Should get balance when account has no tokens', async () => {
            expect(await iexecPoco.balanceOf(anyone.address)).equal(0);
        });
        it('Should get balance when account has some tokens', async () => {
            expect(await iexecPoco.balanceOf(holder.address)).equal(value);
        });
    });

    describe('Transfer', () => {
        it('Should transfer tokens', async () => {
            const transferArgs = [recipient.address, BigNumber.from(value)] as [string, BigNumber];
            expect(await iexecPocoAsHolder.callStatic.transfer(...transferArgs)).to.be.true;
            await expect(iexecPocoAsHolder.transfer(...transferArgs))
                .to.changeTokenBalances(iexecPoco, [holder, recipient], [-value, value])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(holder.address, recipient.address, value);
        });
        it('Should transfer zero tokens', async () => {
            await expect(iexecPocoAsHolder.transfer(recipient.address, 0))
                .to.changeTokenBalances(iexecPoco, [holder, recipient], [0, 0])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(holder.address, recipient.address, 0);
        });
        it('Should not transfer from the zero address', async () => {
            await expect(
                iexecPoco.connect(zeroAddressSigner).transfer(recipient.address, value),
            ).to.be.revertedWith('ERC20: transfer from the zero address');
        });
        it('Should not transfer to the zero address', async () => {
            await expect(iexecPocoAsHolder.transfer(zeroAddress, value)).to.be.revertedWith(
                'ERC20: transfer to the zero address',
            );
        });
        it('Should not transfer when sender balance is too low', async () => {
            await expect(
                iexecPocoAsHolder.transfer(recipient.address, value + 1),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Approve', () => {
        it('Should approve tokens', async () => {
            const approveArgs = [spender.address, BigNumber.from(value)] as [string, BigNumber];
            expect(await iexecPocoAsHolder.callStatic.approve(...approveArgs)).to.be.true;
            await expect(iexecPocoAsHolder.approve(...approveArgs))
                .to.emit(iexecPoco, 'Approval')
                .withArgs(holder.address, spender.address, value);
            expect(await iexecPoco.allowance(holder.address, spender.address)).equal(value);
        });
        it('Should not approve from the zero address', async () => {
            await expect(
                iexecPoco.connect(zeroAddressSigner).approve(spender.address, value),
            ).to.be.revertedWith('ERC20: approve from the zero address');
        });
        it('Should not approve the zero address', async () => {
            await expect(iexecPocoAsHolder.approve(zeroAddress, value)).to.be.revertedWith(
                'ERC20: approve to the zero address',
            );
        });
    });

    describe('Approve and call', () => {
        const extraData = '0x';
        let testReceiver: TestReceiver;

        beforeEach('Init', async () => {
            testReceiver = await new TestReceiver__factory()
                .connect(anyone)
                .deploy()
                .then((instance) => instance.deployed());
        });

        it('Should approve and call', async () => {
            const approveAndCallArgs = [testReceiver.address, BigNumber.from(value), extraData] as [
                string,
                BigNumber,
                string,
            ];
            expect(await iexecPocoAsHolder.callStatic.approveAndCall(...approveAndCallArgs)).to.be
                .true;
            await expect(iexecPocoAsHolder.approveAndCall(...approveAndCallArgs))
                .to.emit(iexecPoco, 'Approval')
                .withArgs(holder.address, testReceiver.address, value)
                .to.emit(testReceiver, 'GotApproval')
                .withArgs(holder.address, value, proxyAddress, extraData);
            expect(await iexecPoco.allowance(holder.address, testReceiver.address)).equal(value);
        });
        it('Should not approve and call from the zero address', async () => {
            await expect(
                iexecPoco
                    .connect(zeroAddressSigner)
                    .approveAndCall(testReceiver.address, 0, extraData),
            ).to.be.revertedWith('ERC20: approve from the zero address');
        });
        it('Should not approve and call for the zero address', async () => {
            await expect(
                iexecPocoAsHolder.approveAndCall(zeroAddress, 0, extraData),
            ).to.be.revertedWith('ERC20: approve to the zero address');
        });
        it('Should not approve and call when receiver refuses approval', async () => {
            await expect(
                iexecPocoAsHolder.approveAndCall(
                    testReceiver.address,
                    0, // TestReceiver will revert with this value
                    extraData,
                ),
            ).to.be.revertedWith('approval-refused');
        });
    });

    describe('Transfer from', () => {
        it('Should transferFrom some tokens', async () => {
            await iexecPocoAsHolder.approve(spender.address, value).then((tx) => tx.wait());
            const transferFromArgs = [holder.address, spender.address, BigNumber.from(value)] as [
                string,
                string,
                BigNumber,
            ];
            expect(await iexecPocoAsSpender.callStatic.transferFrom(...transferFromArgs)).to.be
                .true;
            await expect(iexecPocoAsSpender.transferFrom(...transferFromArgs))
                .to.changeTokenBalances(iexecPoco, [holder, spender], [-value, value])
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(holder.address, spender.address, value)
                .to.emit(iexecPoco, 'Approval')
                .withArgs(holder.address, spender.address, 0);
            expect(await iexecPoco.allowance(holder.address, spender.address)).equal(0);
        });
        it('Should not transferFrom when owner is the zero address', async () => {
            await expect(
                iexecPocoAsSpender.transferFrom(zeroAddress, spender.address, value),
            ).to.be.revertedWith('ERC20: transfer from the zero address');
        });
        it('Should not transferFrom to the zero address', async () => {
            await expect(
                iexecPocoAsSpender.transferFrom(holder.address, zeroAddress, value),
            ).to.be.revertedWith('ERC20: transfer to the zero address');
        });
        it('Should not transferFrom when owner balance is too low', async () => {
            await expect(
                iexecPocoAsSpender.transferFrom(holder.address, spender.address, value + 1),
            ).to.be.revertedWithoutReason();
        });
        it('Should not transferFrom when spender allowance is too low', async () => {
            await iexecPocoAsHolder.approve(spender.address, value - 1).then((tx) => tx.wait());
            await expect(
                iexecPocoAsSpender.transferFrom(holder.address, spender.address, value),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Increase allowance', () => {
        it('Should increase allowance', async () => {
            await iexecPocoAsHolder.approve(spender.address, value).then((tx) => tx.wait());
            const allowanceToIncrease = 1;
            const increaseAllowanceArgs = [
                spender.address,
                BigNumber.from(allowanceToIncrease),
            ] as [string, BigNumber];
            expect(await iexecPocoAsHolder.callStatic.increaseAllowance(...increaseAllowanceArgs))
                .to.be.true;
            await expect(iexecPocoAsHolder.increaseAllowance(...increaseAllowanceArgs))
                .to.emit(iexecPoco, 'Approval')
                .withArgs(holder.address, spender.address, value + allowanceToIncrease);
            expect(await iexecPoco.allowance(holder.address, spender.address)).equal(
                value + allowanceToIncrease,
            );
        });
        it('Should not increase allowance from the zero address', async () => {
            await expect(
                iexecPoco.connect(zeroAddressSigner).increaseAllowance(spender.address, value),
            ).to.be.revertedWith('ERC20: approve from the zero address');
        });
        it('Should not increase allowance for the zero address', async () => {
            await expect(
                iexecPocoAsHolder.increaseAllowance(zeroAddress, value),
            ).to.be.revertedWith('ERC20: approve to the zero address');
        });
    });

    describe('Decrease allowance', () => {
        it('Should decrease allowance', async () => {
            await iexecPocoAsHolder.approve(spender.address, value).then((tx) => tx.wait());
            const allowanceToDecrease = 1;
            const decreaseAllowanceArgs = [
                spender.address,
                BigNumber.from(allowanceToDecrease),
            ] as [string, BigNumber];
            expect(await iexecPocoAsHolder.callStatic.decreaseAllowance(...decreaseAllowanceArgs))
                .to.be.true;
            await expect(iexecPocoAsHolder.decreaseAllowance(...decreaseAllowanceArgs))
                .to.emit(iexecPoco, 'Approval')
                .withArgs(holder.address, spender.address, value - allowanceToDecrease);
            expect(await iexecPoco.allowance(holder.address, spender.address)).equal(
                value - allowanceToDecrease,
            );
        });
        it('Should not decrease allowance of a value greater than old allowance', async () => {
            await expect(
                iexecPocoAsHolder.decreaseAllowance(spender.address, 1),
            ).to.be.revertedWithoutReason();
        });
        it('Should not decrease allowance from the zero address', async () => {
            await expect(
                iexecPoco.connect(zeroAddressSigner).decreaseAllowance(spender.address, 0),
            ).to.be.revertedWith('ERC20: approve from the zero address');
        });
        it('Should not decrease allowance for the zero address', async () => {
            await expect(iexecPocoAsHolder.decreaseAllowance(zeroAddress, 0)).to.be.revertedWith(
                'ERC20: approve to the zero address',
            );
        });
    });
});
