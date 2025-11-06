// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
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
import { TAG_TEE } from '../../../utils/constants';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../../../utils/createOrders';
import { encodeOrders } from '../../../utils/odb-tools';
import { getDealId, getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const volume = 1n;

describe('IexecEscrowToken-receiveApproval', () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceToken;
    let iexecPocoAsRequester: IexecInterfaceToken;
    let rlcInstance: RLC;
    let rlcInstanceAsRequester: RLC;
    let [
        iexecAdmin,
        requester,
        scheduler,
        appProvider,
        datasetProvider,
        anyone,
    ]: SignerWithAddress[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, requester, scheduler, appProvider, datasetProvider, anyone } = accounts);

        iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, anyone);
        iexecPocoAsRequester = iexecPoco.connect(requester);

        rlcInstance = RLC__factory.connect(await iexecPoco.token(), anyone);
        rlcInstanceAsRequester = rlcInstance.connect(requester);

        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());

        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        ordersAssets = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
        };
        ordersPrices = {
            app: appPrice,
            dataset: datasetPrice,
            workerpool: workerpoolPrice,
        };

        // Transfer RLC to accounts for testing
        const totalAmount = (appPrice + datasetPrice + workerpoolPrice) * volume * 100n;
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(requester.address, totalAmount)
            .then((tx) => tx.wait());
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(scheduler.address, totalAmount)
            .then((tx) => tx.wait());
    }

    describe('Basic receiveApproval (backward compatibility)', () => {
        it('Should deposit tokens via approveAndCall with empty data', async () => {
            const depositAmount = 1000n;
            const initialTotalSupply = await iexecPoco.totalSupply();
            const initialBalance = await iexecPoco.balanceOf(requester.address);

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                depositAmount,
                '0x',
            );

            // Verify RLC transfer
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, depositAmount);

            // Verify internal mint
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, depositAmount);

            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + depositAmount);
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(
                initialBalance + depositAmount,
            );
        });

        it('Should deposit 0 tokens via approveAndCall', async () => {
            const depositAmount = 0n;

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, depositAmount, '0x');

            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, depositAmount);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, depositAmount);
        });
    });

    describe('receiveApproval with Order Matching', () => {
        it('Should approve, deposit and match orders with all assets', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(orders);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const initialBalance = await iexecPoco.balanceOf(requester.address);
            const initialTotalSupply = await iexecPoco.totalSupply();

            const encodedOrders = encodeOrdersForCallback(orders);

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders,
            );

            // Verify RLC transfer from requester to proxy
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealCost);

            // Verify internal mint (deposit)
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            // Verify deal was matched
            const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(orders);

            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);

            await expect(tx)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId);

            await expect(tx)
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                );

            // Verify frozen balance
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);

            // Verify total supply increased
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + dealCost);
            // Total balance should be existing + new deposit - frozen
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(
                initialBalance + dealCost - dealCost,
            );
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should approve, deposit and match orders without dataset', async () => {
            const ordersWithoutDataset = buildOrders({
                assets: { ...ordersAssets, dataset: AddressZero },
                prices: { app: appPrice, workerpool: workerpoolPrice },
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(ordersWithoutDataset);

            const dealCost = (appPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const { appOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(ordersWithoutDataset);

            const dealId = getDealId(iexecWrapper.getDomain(), ordersWithoutDataset.requester);
            const encodedOrders = encodeOrdersForCallback(ordersWithoutDataset);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    ethers.ZeroHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                );

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should work when requester has existing balance', async () => {
            // First, deposit some tokens traditionally
            const existingDeposit = 500_000n;
            await rlcInstanceAsRequester.approve(proxyAddress, existingDeposit);
            await iexecPocoAsRequester.deposit(existingDeposit);

            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(orders);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const initialBalance = await iexecPoco.balanceOf(requester.address);
            const encodedOrders = encodeOrdersForCallback(orders);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            // Total balance should be existing + new deposit - frozen
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(
                initialBalance + dealCost - dealCost,
            );
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should not match orders when caller is not requester', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: anyone.address, // Different from caller
                tag: TAG_TEE,
                volume: volume,
            });

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const encodedOrders = encodeOrdersForCallback(orders);

            await expect(
                rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders),
            ).to.be.revertedWith('caller-must-be-requester');
        });

        it('Should not match orders with insufficient deposit', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(orders);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const insufficientAmount = dealCost - 1n;
            const encodedOrders = encodeOrdersForCallback(orders);

            // Should revert from matchOrders due to insufficient balance
            await expect(
                rlcInstanceAsRequester.approveAndCall(
                    proxyAddress,
                    insufficientAmount,
                    encodedOrders,
                ),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });

        it('Should not match orders with invalid calldata', async () => {
            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const invalidData = '0x1234'; // Too short to be valid

            await expect(rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, invalidData))
                .to.be.reverted; // Will fail during abi.decode
        });

        it('Should handle multiple sequential approveAndCall operations', async () => {
            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            // Deposit enough stake for both deals
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake * 2n);

            // First operation
            const orders1 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signAndPrepareOrders(orders1);

            const encodedOrders1 = encodeOrdersForCallback(orders1);

            const tx1 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders1,
            );

            const dealId1 = getDealId(iexecWrapper.getDomain(), orders1.requester);
            await expect(tx1)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId1);

            // Second operation with different salt
            const orders2 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signAndPrepareOrders(orders2);

            const encodedOrders2 = encodeOrdersForCallback(orders2);

            const tx2 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders2,
            );

            const dealId2 = getDealId(iexecWrapper.getDomain(), orders2.requester);
            await expect(tx2)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId2);

            // Both deals should be frozen
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost * 2n);
        });

        it('Should handle zero price orders', async () => {
            const ordersZeroPrice = buildOrders({
                assets: ordersAssets,
                prices: { app: 0n, dataset: 0n, workerpool: 0n },
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(ordersZeroPrice);

            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(0n, volume);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const dealCost = 0n;
            const encodedOrders = encodeOrdersForCallback(ordersZeroPrice);
            const dealId = getDealId(iexecWrapper.getDomain(), ordersZeroPrice.requester);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(0n);
        });
    });

    describe('Gas comparison', () => {
        it('Should use less gas than separate transactions', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signAndPrepareOrders(orders);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake * 2n);

            // Traditional approach: 3 transactions
            const tx1 = await rlcInstanceAsRequester.approve(proxyAddress, dealCost);
            const receipt1 = await tx1.wait();

            const tx2 = await iexecPocoAsRequester.deposit(dealCost);
            const receipt2 = await tx2.wait();

            const tx3 = await iexecPocoAsRequester.matchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            );
            const receipt3 = await tx3.wait();

            const traditionalGas = receipt1!.gasUsed + receipt2!.gasUsed + receipt3!.gasUsed;

            // Reset for new test
            await iexecPocoAsRequester.withdraw(await iexecPoco.balanceOf(requester.address));

            // New approach: 1 transaction
            const orders2 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signAndPrepareOrders(orders2);

            const encodedOrders = encodeOrdersForCallback(orders2);
            const tx4 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders,
            );
            const receipt4 = await tx4.wait();

            const newGas = receipt4!.gasUsed;

            console.log(`Traditional (3 txs): ${traditionalGas.toString()} gas`);
            console.log(`New (1 tx): ${newGas.toString()} gas`);
            console.log(
                `Saved: ${(traditionalGas - newGas).toString()} gas (${(((traditionalGas - newGas) * 100n) / traditionalGas).toString()}%)`,
            );

            expect(newGas).to.be.lt(traditionalGas);
        });
    });

    async function signAndPrepareOrders(orders: IexecOrders): Promise<void> {
        await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
    }

    function encodeOrdersForCallback(orders: IexecOrders): string {
        return encodeOrders(orders.app, orders.dataset, orders.workerpool, orders.requester);
    }
});
