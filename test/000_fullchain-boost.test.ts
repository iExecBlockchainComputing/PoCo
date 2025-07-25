// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { TypedDataDomain } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
    IexecAccessors,
    IexecAccessors__factory,
    IexecOrderManagement__factory,
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet,
    IexecPocoBoostFacet__factory,
    TestClient__factory,
    WorkerpoolInterface__factory,
} from '../typechain';
import * as constants from '../utils/constants';
import {
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    hashOrder,
    signOrders,
} from '../utils/createOrders';
import {
    buildAndSignContributionAuthorizationMessage,
    buildAndSignEnclaveMessage,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getDealId,
    getIexecAccounts,
    getTaskId,
    setNextBlockTimestamp,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from './utils/hardhat-fixture-deployer';

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0n;
const volume = taskIndex + 1n;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;

describe('IexecPocoBoostFacet (IT)', function () {
    let domain: TypedDataDomain;
    let proxyAddress: string;
    let iexecInstance: IexecAccessors;
    let iexecPocoBoostInstance: IexecPocoBoostFacet;
    let iexecWrapper: IexecWrapper;
    let appAddress = '';
    let workerpoolAddress = '';
    let datasetAddress = '';
    let [
        owner,
        requester,
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker,
        enclave,
        anyone,
        teeBroker,
    ] = [] as SignerWithAddress[];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy IexecPocoBoostFacet', async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        iexecPocoBoostInstance = IexecPocoBoostFacet__factory.connect(proxyAddress, owner);
        iexecInstance = IexecAccessors__factory.connect(proxyAddress, anyone);
        domain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: hre.network.config.chainId,
            verifyingContract: proxyAddress,
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
        // initialize tee broker to address(0)
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            iexecAdmin: owner,
            requester,
            sponsor,
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            worker,
            enclave,
            anyone,
            sms: teeBroker,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
    }

    describe('MatchOrders', function () {
        it('Should match orders (TEE)', async function () {
            const callbackAddress = ethers.Wallet.createRandom().address;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: callbackAddress,
            });
            const {
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requesterOrder: requestOrder,
            } = orders.toObject();
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                1n; // volume
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(0);
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(0);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const startTime = await setNextBlockTimestamp();

            expect(
                await iexecPocoBoostInstance.matchOrdersBoost.staticCall(...orders.toArray()),
            ).to.equal(dealId);
            await expect(iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()))
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    hashOrder(domain, datasetOrder),
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                )
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(requester.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, proxyAddress, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake);
            const deal = await viewDealBoost(dealId);
            expect(deal.appOwner).to.be.equal(appProvider.address);
            expect(deal.appPrice).to.be.equal(appPrice);
            expect(deal.datasetOwner).to.be.equal(datasetProvider.address);
            expect(deal.datasetPrice).to.be.equal(datasetPrice);
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address);
            expect(deal.workerpoolPrice).to.be.equal(workerpoolPrice);
            expect(deal.requester).to.be.equal(requester.address);
            const schedulerRewardRatio = await WorkerpoolInterface__factory.connect(
                workerpoolAddress,
                anyone,
            ).m_schedulerRewardRatioPolicy();
            expect(deal.workerReward)
                .to.be.equal((workerpoolPrice * (100n - schedulerRewardRatio)) / 100n)
                .to.be.greaterThan(0);
            expect(deal.deadline).to.be.equal(startTime + 7n * 300n); // Category 0
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(1);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.callback).to.be.equal(callbackAddress);
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
        });

        it('Should match orders with pre-signatures (TEE)', async function () {
            let iexecOrderManagementInstance = IexecOrderManagement__factory.connect(
                proxyAddress,
                anyone,
            );
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
            }).toObject();
            await iexecOrderManagementInstance.connect(appProvider).manageAppOrder({
                order: appOrder,
                operation: 0,
                sign: '0x',
            });
            await iexecOrderManagementInstance.connect(datasetProvider).manageDatasetOrder({
                order: datasetOrder,
                operation: 0,
                sign: '0x',
            });
            await iexecOrderManagementInstance.connect(scheduler).manageWorkerpoolOrder({
                order: workerpoolOrder,
                operation: 0,
                sign: '0x',
            });
            await iexecOrderManagementInstance.connect(requester).manageRequestOrder({
                order: requestOrder,
                operation: 0,
                sign: '0x',
            });
            const dealId = getDealId(domain, requestOrder, taskIndex);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    hashOrder(domain, datasetOrder),
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                );
        });

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
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                1n; // volume
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            expect(await iexecInstance.balanceOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.frozenOf(sponsor.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(0);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const startTime = await setNextBlockTimestamp();

            expect(
                await iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost.staticCall(...orders.toArray()),
            ).to.equal(dealId);
            await expect(
                iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost(...orders.toArray()),
            )
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    hashOrder(domain, datasetOrder),
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                )
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(sponsor.address, proxyAddress, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(sponsor.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, proxyAddress, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'DealSponsoredBoost')
                .withArgs(dealId, sponsor.address);
            const deal = await viewDealBoost(dealId);
            expect(deal.appOwner).to.be.equal(appProvider.address);
            expect(deal.appPrice).to.be.equal(appPrice);
            expect(deal.datasetOwner).to.be.equal(datasetProvider.address);
            expect(deal.datasetPrice).to.be.equal(datasetPrice);
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address);
            expect(deal.workerpoolPrice).to.be.equal(workerpoolPrice);
            expect(deal.requester).to.be.equal(requester.address);
            expect(deal.sponsor).to.be.equal(sponsor.address);
            const schedulerRewardRatio = await WorkerpoolInterface__factory.connect(
                workerpoolAddress,
                anyone,
            ).m_schedulerRewardRatioPolicy();
            expect(deal.workerReward)
                .to.be.equal((workerpoolPrice * (100n - schedulerRewardRatio)) / 100n)
                .to.be.greaterThan(0);
            expect(deal.deadline).to.be.equal(startTime + 7n * 300n); // Category 0
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(1);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.callback).to.be.equal(callbackAddress);
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
        });
    });

    describe('PushResult', function () {
        it('Should push result (TEE & callback)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.waitForDeployment());
            requestOrder.callback = await oracleConsumerInstance.getAddress();
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );
            const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                callbackResultDigest,
                enclave,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results)
                .to.emit(oracleConsumerInstance, 'GotResult')
                .withArgs(taskId, resultsCallback);
            expect((await iexecInstance.viewTask(taskId)).status).to.equal(3); // COMPLETED
            expect(await oracleConsumerInstance.store(taskId)).to.be.equal(resultsCallback);
        });

        it('Should push result (TEE with contribution authorization signed by scheduler)', async function () {
            const volume = 3n;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: volume,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * volume;
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            const schedulerTaskStake = schedulerDealStake / volume;
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                resultDigest,
                enclave,
            );
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerDealStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(worker.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(appProvider.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(datasetProvider.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            const expectedWorkerReward = (await viewDealBoost(dealId)).workerReward;
            const schedulerBaseReward = workerpoolPrice - expectedWorkerReward;

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(requester.address, taskPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, worker.address, expectedWorkerReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(worker.address, expectedWorkerReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, appProvider.address, appPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, datasetProvider.address, datasetPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, scheduler.address, schedulerBaseReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(scheduler.address, schedulerBaseReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
            const remainingTasksToPush = volume - 1n;
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                (taskPrice + schedulerTaskStake) * remainingTasksToPush,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(
                taskPrice * remainingTasksToPush,
            );
            expect(await iexecInstance.balanceOf(worker.address)).to.be.equal(expectedWorkerReward);
            expect(await iexecInstance.balanceOf(appProvider.address)).to.be.equal(appPrice);
            expect(await iexecInstance.balanceOf(datasetProvider.address)).to.be.equal(
                datasetPrice,
            );
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(
                schedulerTaskStake + schedulerBaseReward,
            );
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(
                schedulerTaskStake * remainingTasksToPush,
            );
            //TODO: Eventually add check where scheduler is rewarded with kitty (already covered in UT)
        });

        it('Should push result (TEE with contribution authorization signed by broker)', async function () {
            await iexecWrapper.setTeeBroker(teeBroker.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const teeBrokerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                teeBroker,
            );
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                resultDigest,
                enclave,
            );
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        teeBrokerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            );
        });
    });

    describe('Claim', function () {
        it('Should refund requester on claim of non sponsored deal (TEE)', async function () {
            const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
            const claimedTasks = 1n;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            // Deposit RLC in the scheduler's account.
            const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                expectedVolume,
            );
            const schedulerTaskStake = schedulerDealStake / expectedVolume;

            const kittyAddress = await iexecInstance.kitty_address();

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerDealStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            expect(await iexecInstance.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(kittyAddress)).to.be.equal(0);
            await time.setNextBlockTimestamp(startTime + 7n * 300n);

            await expect(iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, requester.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(requester.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(scheduler.address, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(kittyAddress, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(kittyAddress, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);

            expect((await iexecInstance.viewTask(taskId)).status).to.equal(4); // FAILED
            const remainingTasksToClaim = expectedVolume - claimedTasks;
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                taskPrice * remainingTasksToClaim + // requester has 2nd & 3rd task locked
                    schedulerDealStake, // kitty value since 1st task seized
            );
            // 2nd & 3rd tasks can still be claimed.
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(
                taskPrice * claimedTasks,
            );
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(
                taskPrice * remainingTasksToClaim,
            );
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(
                schedulerTaskStake * remainingTasksToClaim,
            );
            expect(await iexecInstance.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(kittyAddress)).to.be.equal(
                schedulerTaskStake * claimedTasks,
            );
        });

        it('Should refund sponsor on claim of a sponsored deal (TEE)', async function () {
            const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
            const claimedTasks = 1n;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            // Deposit RLC in the scheduler's account.
            const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                expectedVolume,
            );
            const schedulerTaskStake = schedulerDealStake / expectedVolume;

            const kittyAddress = await iexecInstance.kitty_address();

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .connect(sponsor)
                .sponsorMatchOrdersBoost(appOrder, datasetOrder, workerpoolOrder, requestOrder);
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                dealPrice + schedulerDealStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            expect(await iexecInstance.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(kittyAddress)).to.be.equal(0);
            await time.setNextBlockTimestamp(startTime + 7n * 300n);

            await expect(iexecPocoBoostInstance.connect(anyone).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, sponsor.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(sponsor.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(scheduler.address, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(kittyAddress, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(kittyAddress, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);

            expect((await iexecInstance.viewTask(taskId)).status).to.equal(4); // FAILED
            const remainingTasksToClaim = expectedVolume - claimedTasks;
            expect(await iexecInstance.balanceOf(proxyAddress)).to.be.equal(
                taskPrice * remainingTasksToClaim + // sponsor has 2nd & 3rd task locked
                    schedulerDealStake, // kitty value since 1st task seized
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            // 2nd & 3rd tasks can still be claimed.
            expect(await iexecInstance.balanceOf(sponsor.address)).to.be.equal(
                taskPrice * claimedTasks,
            );
            expect(await iexecInstance.frozenOf(sponsor.address)).to.be.equal(
                taskPrice * remainingTasksToClaim,
            );
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(
                schedulerTaskStake * remainingTasksToClaim,
            );
            expect(await iexecInstance.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(kittyAddress)).to.be.equal(
                schedulerTaskStake * claimedTasks,
            );
        });
    });

    async function viewDealBoost(dealId: string) {
        return await IexecPocoBoostAccessorsFacet__factory.connect(
            proxyAddress,
            anyone,
        ).viewDealBoost(dealId);
    }
});
