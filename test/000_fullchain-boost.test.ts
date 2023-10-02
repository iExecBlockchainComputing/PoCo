/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

import { ContractReceipt } from '@ethersproject/contracts';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { TypedDataDomain } from 'ethers';
import hre, { deployments, ethers } from 'hardhat';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecAccessors,
    IexecAccessors__factory,
    IexecMaintenanceDelegate__factory,
    IexecOrderManagement__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate,
    IexecPocoBoostDelegate__factory,
    RLC,
    RLC__factory,
    TestClient__factory,
    WorkerpoolInterface__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
} from '../typechain';
import constants from '../utils/constants';
import { extractEventsFromReceipt } from '../utils/tools';

import {
    Orders,
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
    getTaskId,
    setNextBlockTimestamp,
} from '../utils/poco-tools';

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;

/**
 * Extract address of a newly created entry in a registry contract
 * from the tx's receipt.
 * @param receipt contract receipt
 * @param registryInstanceAddress address of the registry contract
 * @returns address of the entry in checksum format.
 */
async function extractRegistryEntryAddress(
    receipt: ContractReceipt,
    registryInstanceAddress: string,
): Promise<string> {
    const events = extractEventsFromReceipt(receipt, registryInstanceAddress, 'Transfer');
    const lowercaseAddress = events[0].args['tokenId'].toHexString();
    return ethers.utils.getAddress(lowercaseAddress);
}

describe('IexecPocoBoostDelegate (IT)', function () {
    let domain: TypedDataDomain;
    let proxyAddress: string;
    let iexecInstance: IexecAccessors;
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let rlcInstance: RLC;
    let appAddress = '';
    let workerpoolAddress = '';
    let datasetAddress = '';
    let [
        owner,
        requester,
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

    beforeEach('Deploy IexecPocoBoostDelegate', async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        let signers = await hre.ethers.getSigners();
        owner = signers[0];
        requester = signers[1];
        beneficiary = signers[2];
        appProvider = signers[3];
        datasetProvider = signers[4];
        scheduler = signers[5];
        worker = signers[6];
        enclave = signers[7];
        anyone = signers[8];
        teeBroker = signers[9];
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        await deployments.fixture();
        proxyAddress = await getContractAddress('ERC1538Proxy');
        iexecPocoBoostInstance = IexecPocoBoostDelegate__factory.connect(proxyAddress, owner);
        iexecInstance = IexecAccessors__factory.connect(proxyAddress, anyone);
        rlcInstance = RLC__factory.connect(await iexecInstance.token(), owner);
        domain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: hre.network.config.chainId,
            verifyingContract: proxyAddress,
        };
        const appRegistryInstance: AppRegistry = AppRegistry__factory.connect(
            await getContractAddress('AppRegistry'),
            appProvider,
        );
        const appReceipt = await appRegistryInstance
            .createApp(
                appProvider.address,
                'my-app',
                'APP_TYPE_0',
                constants.NULL.BYTES32,
                constants.NULL.BYTES32,
                constants.NULL.BYTES32,
            )
            .then((tx) => tx.wait());
        appAddress = await extractRegistryEntryAddress(appReceipt, appRegistryInstance.address);

        const workerpoolRegistryInstance: WorkerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await getContractAddress('WorkerpoolRegistry'),
            anyone,
        );
        const workerpoolReceipt = await workerpoolRegistryInstance
            .createWorkerpool(scheduler.address, 'my-workerpool')
            .then((tx) => tx.wait());
        workerpoolAddress = await extractRegistryEntryAddress(
            workerpoolReceipt,
            workerpoolRegistryInstance.address,
        );

        const datasetRegistryInstance: DatasetRegistry = DatasetRegistry__factory.connect(
            await getContractAddress('DatasetRegistry'),
            anyone,
        );
        const datasetReceipt = await datasetRegistryInstance
            .createDataset(
                datasetProvider.address,
                'my-dataset',
                constants.NULL.BYTES32,
                constants.NULL.BYTES32,
            )
            .then((tx) => tx.wait());
        datasetAddress = await extractRegistryEntryAddress(
            datasetReceipt,
            datasetRegistryInstance.address,
        );
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
        await setTeeBroker('0x0000000000000000000000000000000000000000');
    });

    describe('MatchOrders', function () {
        it('Should match orders (TEE)', async function () {
            const callbackAddress = ethers.Wallet.createRandom().address;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: callbackAddress,
            });
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                1; // volume
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(0);
            await getRlcAndDeposit(requester, dealPrice);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const schedulerStake = await computeSchedulerDealStake(
                iexecInstance,
                workerpoolPrice,
                volume,
            );
            await getRlcAndDeposit(scheduler, schedulerStake);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(0);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const startTime = await setNextBlockTimestamp();
            const matchOrdersArgs = [
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            ] as Orders;

            expect(
                await iexecPocoBoostInstance.callStatic.matchOrdersBoost(...matchOrdersArgs),
            ).to.equal(dealId);
            await expect(iexecPocoBoostInstance.matchOrdersBoost(...matchOrdersArgs))
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
                .withArgs(requester.address, iexecPocoBoostInstance.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(requester.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, iexecPocoBoostInstance.address, schedulerStake)
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
            const schedulerRewardRatio = (
                await WorkerpoolInterface__factory.connect(
                    workerpoolAddress,
                    anyone,
                ).m_schedulerRewardRatioPolicy()
            ).toNumber();
            expect(deal.workerReward)
                .to.be.equal((workerpoolPrice * (100 - schedulerRewardRatio)) / 100)
                .to.be.greaterThan(0);
            expect(deal.deadline).to.be.equal(startTime + 7 * 300); // Category 0
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(1);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.callback).to.be.equal(callbackAddress);
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
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
            });
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
    });

    describe('PushResult', function () {
        it('Should push result (TEE & callback)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            requestOrder.callback = oracleConsumerInstance.address;
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
            const volume = 3;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: volume,
            });
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * volume;
            await getRlcAndDeposit(requester, dealPrice);
            const schedulerDealStake = await computeSchedulerDealStake(
                iexecInstance,
                workerpoolPrice,
                volume,
            );
            const schedulerTaskStake = schedulerDealStake / volume;
            await getRlcAndDeposit(scheduler, schedulerDealStake);
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
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
                dealPrice + schedulerDealStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(worker.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(appProvider.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(datasetProvider.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            const expectedWorkerReward = (await viewDealBoost(dealId)).workerReward.toNumber();
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
                .withArgs(iexecInstance.address, worker.address, expectedWorkerReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(worker.address, expectedWorkerReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecInstance.address, appProvider.address, appPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecInstance.address, datasetProvider.address, datasetPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecInstance.address, scheduler.address, schedulerBaseReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(scheduler.address, schedulerBaseReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
            const remainingTasksToPush = volume - 1;
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
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
            await setTeeBroker(teeBroker.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
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
        it('Should claim (TEE)', async function () {
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const claimedTasks = 1;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await getRlcAndDeposit(requester, dealPrice);
            // Deposit RLC in the scheduler's account.
            const schedulerDealStake = await computeSchedulerDealStake(
                iexecInstance,
                workerpoolPrice,
                expectedVolume,
            );
            const schedulerTaskStake = schedulerDealStake / expectedVolume;

            const kittyAddress = await iexecInstance.kitty_address();

            await getRlcAndDeposit(scheduler, schedulerDealStake);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
                dealPrice + schedulerDealStake,
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            expect(await iexecInstance.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(kittyAddress)).to.be.equal(0);
            await time.setNextBlockTimestamp(startTime + 7 * 300);

            await expect(iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, requester.address, taskPrice)
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
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
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
    });

    /**
     * Transfer RLC from owner to recipient and deposit recipient value on iExec.
     * @param value The value to deposit.
     * @param account Deposit value for an account.
     */
    async function getRlcAndDeposit(account: SignerWithAddress, value: number) {
        await rlcInstance.transfer(account.address, value);
        await rlcInstance
            .connect(account)
            .approveAndCall(iexecPocoBoostInstance.address, value, '0x');
    }

    async function viewDealBoost(dealId: string) {
        return await IexecPocoBoostAccessorsDelegate__factory.connect(
            iexecPocoBoostInstance.address,
            anyone,
        ).viewDealBoost(dealId);
    }

    async function setTeeBroker(brokerAddress: string) {
        await IexecMaintenanceDelegate__factory.connect(proxyAddress, owner)
            .setTeeBroker(brokerAddress)
            .then((tx) => tx.wait());
    }
});

/**
 * Get address of contract deployed with hardhat-truffle.
 * @param contractName contract to retrieve
 * @returns deployed address
 */
async function getContractAddress(contractName: string): Promise<string> {
    return await (
        await hre.artifacts.require(contractName).deployed()
    ).address;
}

/**
 * Compute the amount of RLCs to be staked by the scheduler
 * for a deal. We first compute the percentage by task
 * (See contracts/Store.sol#WORKERPOOL_STAKE_RATIO), then
 * compute the total amount according to the volume.
 * @param iexecInstance where to fetch ratio value
 * @param workerpoolPrice
 * @param volume number of tasks of a deal
 * @returns total amount to stake by the scheduler
 */
async function computeSchedulerDealStake(
    iexecInstance: IexecAccessors,
    workerpoolPrice: number,
    volume: number,
): Promise<number> {
    const stakeRatio = (await iexecInstance.workerpool_stake_ratio()).toNumber();
    return ((workerpoolPrice * stakeRatio) / 100) * volume;
}
