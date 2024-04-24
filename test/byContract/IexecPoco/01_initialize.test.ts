// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import {
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    createEmptyWorkerpoolOrder,
} from '../../../utils/createOrders';
import { TaskStatusEnum, getIexecAccounts, getTaskId } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const categoryTime = 300;
const maxDealDuration = 10 * categoryTime;
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;

describe('Poco', async () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceNative;
    let iexecPocoAsAnyone: IexecInterfaceNative;
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [iexecAdmin, requester, anyone]: SignerWithAddress[] = [];
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, requester, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, iexecAdmin);
        iexecPocoAsAnyone = iexecPoco.connect(anyone);
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
    }

    describe('Initialize', function () {
        it('Should initialize', async function () {
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });
            const { dealId, taskId, taskIndex, startTime } =
                await iexecWrapper.signAndMatchOrders(orders);
            expect((await iexecPoco.viewTask(taskId)).status).equal(TaskStatusEnum.UNSET);

            expect(await iexecPocoAsAnyone.callStatic.initialize(dealId, taskIndex)).to.equal(
                taskId,
            );
            const initialize = await iexecPocoAsAnyone.initialize(dealId, taskIndex);
            await initialize.wait();
            await expect(initialize)
                .to.emit(iexecPoco, 'TaskInitialize')
                .withArgs(taskId, orders.workerpool.workerpool);
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).equal(TaskStatusEnum.ACTIVE);
            expect(task.dealid).equal(dealId);
            expect(task.idx).equal(taskIndex);
            expect(task.timeref).equal(categoryTime);
            expect(task.contributionDeadline).equal(startTime + 7 * categoryTime);
            expect(task.finalDeadline).equal(startTime + 10 * categoryTime);
            // m_consensus does not have any getter
        });

        it('Should not initialize since index is too low', async function () {
            const { appOrder, datasetOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: 10,
            });
            const workerpoolOrder0 = {
                ...createEmptyWorkerpoolOrder(),
                workerpool: workerpoolAddress,
                workerpoolPrice,
                volume: 1,
            };
            const workerpoolOrder1 = {
                ...createEmptyWorkerpoolOrder(),
                workerpool: workerpoolAddress,
                workerpoolPrice,
                volume: 9,
            };
            // Request order is matched in 2 deals
            const { dealId: dealId0 } = await iexecWrapper.signAndMatchOrders({
                app: appOrder,
                dataset: datasetOrder,
                workerpool: workerpoolOrder0,
                requester: requestOrder,
            });
            const { dealId: dealId1 } = await iexecWrapper.signAndMatchOrders({
                app: appOrder,
                dataset: datasetOrder,
                workerpool: workerpoolOrder1,
                requester: requestOrder,
            });
            expect((await iexecPoco.viewDeal(dealId0)).botFirst).equal(0);
            expect((await iexecPoco.viewDeal(dealId1)).botFirst).equal(1);

            // Will fail since passed taskIndex is below deal1.botFirst
            await expect(iexecPocoAsAnyone.initialize(dealId1, 0)).to.be.revertedWithoutReason();
        });

        it('Should not initialize since index is too high', async function () {
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });
            const { dealId } = await iexecWrapper.signAndMatchOrders(orders);
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.botFirst).equal(0);
            expect(deal.botSize).equal(1);

            // Will fail since passed taskIndex is above offset + bot size
            await expect(iexecPocoAsAnyone.initialize(dealId, 1)).to.be.revertedWithoutReason();
        });

        it('Should not initialize twice', async function () {
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });
            const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(orders);
            await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
            expect((await iexecPoco.viewTask(taskId)).status).equal(TaskStatusEnum.ACTIVE);

            await expect(
                iexecPocoAsAnyone.initialize(dealId, taskIndex),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('Initialize array', function () {
        it('Should initialize array', async function () {
            const volume = 3;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
            });
            const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
            const dealIds = [dealId, dealId, dealId];
            const taskIndexes = [0, 1, 2];
            await time.setNextBlockTimestamp(startTime + maxDealDuration);
            for (const taskIndex of taskIndexes) {
                const taskId = getTaskId(dealId, taskIndex);
                expect((await iexecPoco.viewTask(taskId)).status).equal(TaskStatusEnum.UNSET);
            }

            expect(await iexecPocoAsAnyone.callStatic.initializeArray(dealIds, taskIndexes)).to.be
                .true;
            const initializeArrayTx = await iexecPocoAsAnyone.initializeArray(dealIds, taskIndexes);
            await initializeArrayTx.wait();
            for (const taskIndex of taskIndexes) {
                const taskId = getTaskId(dealId, taskIndex);
                await expect(initializeArrayTx)
                    .to.emit(iexecPoco, 'TaskInitialize')
                    .withArgs(taskId, orders.workerpool.workerpool);
                expect((await iexecPoco.viewTask(taskId)).status).equal(TaskStatusEnum.ACTIVE);
            }
        });

        it('Should not initialize array if incompatible length of inputs', async function () {
            const dealId = ethers.utils.hashMessage('dealId');
            await expect(
                iexecPoco.initializeArray([dealId, dealId], [0]),
            ).to.be.revertedWithoutReason();
        });

        it('Should not initialize array if one specific fails', async function () {
            const volume = 2;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
            });
            const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
            const taskIndex0 = 0;
            const taskIndex1 = 1;
            await iexecPocoAsAnyone // Make first task already initialized
                .initialize(dealId, taskIndex0)
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + maxDealDuration);

            // Will fail since first task is already initialized
            await expect(
                iexecPoco.initializeArray([dealId, dealId], [taskIndex0, taskIndex1]),
            ).to.be.revertedWithoutReason();
        });
    });
});
