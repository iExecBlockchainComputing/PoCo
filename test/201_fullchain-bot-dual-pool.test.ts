// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import {
    PocoMode,
    TaskStatusEnum,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

// TODO use a better file name.

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
let [requester, appProvider, datasetProvider, scheduler, anyone, worker1]: SignerWithAddress[] = [];
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

describe('Integration tests', function () {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, appProvider, datasetProvider, scheduler, anyone, worker1 } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
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
    }

    /**
     * A test to run full workflow (matchOrder..finalize) with 2 orders having 2 different volumes
     * for the same workerpool and only 1 request order.
     */
    it('[1] No sponsorship, no beneficiary, no callback, BoT, no replication, 2 workerpool orders', async function () {
        const volume = 3;
        const workerpoolOrderVolume1 = 2;
        const workerpoolOrderVolume2 = 10;
        const dealVolume1 = Math.min(workerpoolOrderVolume1, volume); // min(2, 3);
        console.log('🚀 ~ dealVolume1:', dealVolume1);
        const dealVolume2 = Math.min(workerpoolOrderVolume2, volume - dealVolume1); // min(10, 1)
        // console.log("🚀 ~ dealVolume2:", dealVolume2)
        const workerpoolPrice1 = workerpoolPrice + 15;
        console.log('🚀 ~ workerpoolPrice1:', workerpoolPrice1);
        const workerpoolPrice2 = workerpoolPrice + 25;
        const taskPrice1 = appPrice + datasetPrice + workerpoolPrice1;
        console.log('🚀 ~ taskPrice1:', taskPrice1);
        const taskPrice2 = appPrice + datasetPrice + workerpoolPrice2;
        // Create default orders.
        const {
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requesterOrder: requestOrder,
        } = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            volume,
        }).toObject();
        // Create 2 different orders for the same workerpool.
        const workerpoolOrder1 = workerpoolOrder;
        const workerpoolOrder2 = { ...workerpoolOrder }; // Shallow cloning is fine here.
        workerpoolOrder1.volume = workerpoolOrderVolume1;
        workerpoolOrder1.workerpoolprice = workerpoolPrice1;
        workerpoolOrder2.volume = workerpoolOrderVolume2;
        workerpoolOrder2.workerpoolprice = workerpoolPrice2;
        requestOrder.workerpoolmaxprice = Math.max(workerpoolPrice1, workerpoolPrice2);
        // Match both workerpool orders with the same request order.
        const {
            dealId: dealId1,
            taskIndex: taskIndex1,
            dealPrice: dealPrice1,
            schedulerStakePerDeal: schedulerStakeForDeal1,
        } = await iexecWrapper.signAndMatchOrders(
            appOrder,
            datasetOrder,
            workerpoolOrder1,
            requestOrder,
        ); // First task index is 0.
        console.log('🚀 ~ schedulerStakeForDeal1:', schedulerStakeForDeal1);
        console.log('🚀 ~ dealPrice1:', dealPrice1);
        const {
            dealId: dealId2,
            taskIndex: taskIndex2,
            dealPrice: dealPrice2,
            schedulerStakePerDeal: schedulerStakeForDeal2,
        } = await iexecWrapper.signAndMatchOrders(
            appOrder,
            datasetOrder,
            workerpoolOrder2,
            requestOrder,
        ); // First task index is 2.
        // console.log('🚀 ~ dealPrice2:', dealPrice2);
        const deal1 = await iexecPoco.viewDeal(dealId1);
        expect(deal1.botFirst).to.equal(0);
        expect(deal1.botSize).to.equal(dealVolume1);
        const deal2 = await iexecPoco.viewDeal(dealId2);
        expect(deal2.botFirst).to.equal(dealVolume1);
        expect(deal2.botSize).to.equal(dealVolume2);
        // Compute stakes and rewards for each deal.
        const schedulerStakePerTaskOfDeal1 = schedulerStakeForDeal1 / dealVolume1;
        console.log('🚀 ~ schedulerStakePerTaskOfDeal1:', schedulerStakePerTaskOfDeal1);
        const schedulerStakePerTaskOfDeal2 = schedulerStakeForDeal2 / dealVolume2;
        // console.log("🚀 ~ schedulerStakePerTaskOfDeal2:", schedulerStakePerTaskOfDeal2)
        const workersRewardPerTaskOfDeal1 = await iexecWrapper.computeWorkersRewardPerTask(
            dealId1,
            PocoMode.CLASSIC,
        );
        console.log('🚀 ~ workersRewardPerTaskOfDeal1:', workersRewardPerTaskOfDeal1);
        const workersRewardPerTaskOfDeal2 = await iexecWrapper.computeWorkersRewardPerTask(
            dealId2,
            PocoMode.CLASSIC,
        );
        // console.log("🚀 ~ workersRewardPerTaskOfDeal2:", workersRewardPerTaskOfDeal2)

        const schedulerRewardPerTaskOfDeal1 = workerpoolPrice1 - workersRewardPerTaskOfDeal1;
        console.log('🚀 ~ schedulerRewardPerTaskOfDeal1:', schedulerRewardPerTaskOfDeal1);
        const schedulerRewardPerTaskOfDeal2 = workerpoolPrice2 - workersRewardPerTaskOfDeal2;
        // console.log("🚀 ~ schedulerRewardPerTaskOfDeal2:", schedulerRewardPerTaskOfDeal2)

        // Finalize each task and run checks.
        console.log('🚀 ~ run1');
        await runTaskThenCheckBalancesAndVolumes(
            dealId1,
            taskIndex1,
            taskPrice1,
            schedulerStakePerTaskOfDeal1,
            schedulerRewardPerTaskOfDeal1,
            workersRewardPerTaskOfDeal1,
        );
        console.log('🚀 ~ run2');
        await runTaskThenCheckBalancesAndVolumes(
            dealId1,
            taskIndex1 + 1,
            taskPrice1,
            schedulerStakePerTaskOfDeal1,
            schedulerRewardPerTaskOfDeal1,
            workersRewardPerTaskOfDeal1,
        );
        console.log('🚀 ~ run1');
        await runTaskThenCheckBalancesAndVolumes(
            dealId2,
            taskIndex2,
            taskPrice2,
            schedulerStakePerTaskOfDeal2,
            schedulerRewardPerTaskOfDeal2,
            workersRewardPerTaskOfDeal2,
        );
    });

    async function runTaskThenCheckBalancesAndVolumes(
        dealId: string,
        taskIndex: number,
        taskPrice: number,
        schedulerStake: number,
        schedulerReward: number,
        workerReward: number,
    ) {
        // Save frozens.
        const accounts = [requester, scheduler, appProvider, datasetProvider, worker1];
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);
        // Run task.
        const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
        const { workerStakePerTask: workerStake } = await iexecWrapper.contributeToTask(
            dealId,
            taskIndex,
            resultDigest,
            worker1,
        );
        console.log('🚀 ~ taskPrice:', taskPrice);
        console.log('🚀 ~ schedulerStake:', schedulerStake);
        console.log('🚀 ~ schedulerReward:', schedulerReward);
        console.log('🚀 ~ workerStake:', workerStake);
        console.log('🚀 ~ workerReward:', workerReward);
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const finalizeTx = await iexecPoco.connect(scheduler).finalize(taskId, results, '0x');
        await finalizeTx.wait();
        // Check task.
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
        expect(task.idx).to.equal(taskIndex);
        // Verify token balance changes.
        const proxyBalance = await iexecPoco.balanceOf(proxyAddress);
        console.log('🚀 ~ proxyBalance:', proxyBalance);
        const expectedProxyBalanceChange = -(taskPrice + schedulerStake + workerStake);
        console.log('🚀 ~ expectedProxyBalanceChange:', expectedProxyBalanceChange);
        await expect(finalizeTx).to.changeTokenBalances(
            iexecPoco,
            [proxyAddress, requester, scheduler, appProvider, datasetProvider, worker1],
            [
                expectedProxyBalanceChange, // Proxy
                0, // Requester
                schedulerStake + schedulerReward, // Scheduler
                appPrice, // AppProvider
                datasetPrice, // DatasetProvider
                workerStake + workerReward, // Worker
            ],
        );
        // Calculate expected frozen changes
        const expectedFrozenChanges = [
            0, // Proxy
            -taskPrice, // Requester
            -schedulerStake, // Scheduler
            0, // AppProvider
            0, // DatasetProvider
            0, // Worker
        ];
        await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
    }
});
