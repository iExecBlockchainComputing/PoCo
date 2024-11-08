// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecPocoAccessors__factory,
} from '../typechain';
import {
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../utils/createOrders';
import {
    PocoMode,
    TaskStatusEnum,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getDealId,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

//  +---------+-------------+-------------+-------------+----------+-----+----------------+
//  |         | Sponsorship | Replication | Beneficiary | Callback | BoT |      Type      |
//  +---------+-------------+-------------+-------------+----------+-----+----------------+
//  |   [1]   |     ✔       |     ✔       |     ✔       |    ✔     |  ✔  |   Standard     |
//  |   [2]   |     x       |     ✔       |     ✔       |    ✔     |  ✔  |   Standard     |
//  |   [3]   |     ✔       |     x       |     ✔       |    ✔     |  ✔  |  Standard,TEE  |
//  |   [4]   |     x       |     x       |     ✔       |    ✔     |  ✔  |  Standard,TEE  |
//  |   [5]   |     x       |     x       |     x       |    x     |  x  |  Standard,TEE  |
//  +---------+-------------+-------------+----------+-----+-------------+----------------+

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const callbackAddress = ethers.Wallet.createRandom().address;
const { results } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
let [
    requester,
    sponsor,
    beneficiary,
    appProvider,
    datasetProvider,
    scheduler,
    anyone,
    worker1,
]: SignerWithAddress[] = [];
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
        ({
            requester,
            sponsor,
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            anyone,
            worker1,
        } = accounts);
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

    it('[1] Sponsorship, beneficiary, callback, BoT, replication', async function () {
        const volume = 3;
        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: 1, // TODO use 5 workers.
        });
        const { dealId, dealPrice, schedulerStakePerDeal } =
            await iexecWrapper.signAndSponsorMatchOrders(...orders.toArray());
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workerRewardPerTask = await iexecWrapper.computeWorkerRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workerRewardPerTask;
        // Check initial balances.
        await checkBalancesAndFrozens({
            proxyBalance: dealPrice + schedulerStakePerDeal,
            accounts: [
                { signer: sponsor, balance: 0, frozen: dealPrice },
                { signer: requester, balance: 0, frozen: 0 },
                { signer: scheduler, balance: 0, frozen: schedulerStakePerDeal },
                { signer: appProvider, balance: 0, frozen: 0 },
                { signer: datasetProvider, balance: 0, frozen: 0 },
                { signer: worker1, balance: 0, frozen: 0 },
            ],
        });
        // Finalize each task and check balance changes.
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const { workerStakePerTask } = await iexecWrapper.contributeToTask(
                dealId,
                taskIndex,
                callbackResultDigest,
                worker1,
            );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback)
                .then((tx) => tx.wait());
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // For each task, balances change such as:
            //   - Sponsor
            //      - frozen: frozenBefore - taskPrice
            //   - Requester: no changes
            //   - Scheduler
            //      - balance: balanceBefore + taskStake + taskReward
            //      - frozen: frozenBefore - taskStake
            //   - App
            //      - balance: balance before + appPrice
            //   - Dataset
            //      - balance: balance before + datasetPrice
            //   - Worker:
            //      - balance: balance before + taskStake + taskReward
            //      - frozen: frozen before - taskStake
            await checkBalancesAndFrozens({
                proxyBalance:
                    dealPrice +
                    schedulerStakePerDeal -
                    (taskPrice + schedulerStakePerTask) * completedTasks,
                accounts: [
                    { signer: sponsor, balance: 0, frozen: dealPrice - taskPrice * completedTasks },
                    { signer: requester, balance: 0, frozen: 0 },
                    {
                        signer: scheduler,
                        balance: (schedulerStakePerTask + schedulerRewardPerTask) * completedTasks,
                        frozen: schedulerStakePerDeal - schedulerStakePerTask * completedTasks,
                    },
                    { signer: appProvider, balance: appPrice * completedTasks, frozen: 0 },
                    { signer: datasetProvider, balance: datasetPrice * completedTasks, frozen: 0 },
                    {
                        signer: worker1,
                        balance: (workerStakePerTask + workerRewardPerTask) * completedTasks,
                        frozen: 0,
                    },
                ],
            });
        }
    });

    // TODO implement the following tests.

    it('[2] No sponsorship, beneficiary, callback, BoT, replication', async function () {});

    it('[3] Sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[4] No sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[5] No sponsorship, no beneficiary, no callback, no BoT, no replication', async function () {});

    describe.skip('MatchOrders', function () {
        it('Should sponsor match orders (TEE)', async function () {
            const callbackAddress = ethers.Wallet.createRandom().address;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: callbackAddress,
            });
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                volume;
            expect(await iexecAccessor.balanceOf(proxyAddress)).to.be.equal(0);
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            expect(await iexecAccessor.balanceOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecAccessor.frozenOf(sponsor.address)).to.be.equal(0);
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(requester.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            expect(await iexecAccessor.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecAccessor.frozenOf(scheduler.address)).to.be.equal(0);
            await signOrders(domain, orders, ordersActors);
            const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(orders);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            expect(
                await IexecPocoAccessors__factory.connect(proxyAddress, anyone).computeDealVolume(
                    ...orders.toArray(),
                ),
            ).to.equal(volume);

            expect(
                await iexecPoco.connect(sponsor).callStatic.sponsorMatchOrders(...orders.toArray()),
            ).to.equal(dealId);
            await expect(iexecPoco.connect(sponsor).sponsorMatchOrders(...orders.toArray()))
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                )
                .to.emit(iexecPoco, 'DealSponsored')
                .withArgs(dealId, sponsor.address);
            expect(await iexecAccessor.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerStake,
            );
            expect(await iexecAccessor.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
            const deal = await iexecAccessor.viewDeal(dealId);
            expect(deal.sponsor).to.be.equal(sponsor.address);
        });
    });
});

async function checkBalancesAndFrozens(args: {
    proxyBalance: number;
    accounts: { signer: SignerWithAddress; balance: number; frozen: number }[];
}) {
    expect(await iexecPoco.balanceOf(proxyAddress)).to.equal(args.proxyBalance);
    for (const account of args.accounts) {
        const message = `Failed with account at index ${args.accounts.indexOf(account)}`;
        expect(await iexecPoco.balanceOf(account.signer.address)).to.equal(
            account.balance,
            message,
        );
        expect(await iexecPoco.frozenOf(account.signer.address)).to.equal(account.frozen, message);
    }
}
