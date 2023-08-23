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

import { expect } from 'chai';
import hre, { ethers, deployments } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain, BigNumber } from 'ethers';
import {
    IexecOrderManagement,
    IexecOrderManagement__factory,
    IexecPocoBoostDelegate__factory,
    IexecPocoBoostDelegate,
    AppRegistry__factory,
    AppRegistry,
    WorkerpoolRegistry__factory,
    WorkerpoolRegistry,
    DatasetRegistry,
    DatasetRegistry__factory,
    TestClient__factory,
    RLC__factory,
    IexecAccessors__factory,
    IexecAccessors,
    RLC,
} from '../typechain';
import constants from '../utils/constants';
import { extractEventsFromReceipt } from '../utils/tools';
import { ContractReceipt } from '@ethersproject/contracts';

import {
    Iexec,
    IexecAccounts,
    buildCompatibleOrders,
    hashOrder,
    signOrders,
} from '../utils/createOrders';
import {
    buildAndSignSchedulerMessage,
    buildUtf8ResultAndDigest,
    buildResultCallbackAndDigest,
    buildAndSignEnclaveMessage,
    getDealId,
    getTaskId,
} from '../utils/poco-tools';

const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
const startTime = 9876543210;
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

describe('IexecPocoBoostDelegate (integration tests)', function () {
    let domain: TypedDataDomain;
    //TODO: Rename to iexecOrderManagementInstance
    let iexecCategoryManagementInstance: IexecOrderManagement;
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
    ] = [] as SignerWithAddress[];
    let accounts: IexecAccounts;
    let entriesAndRequester: Iexec<string>;
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
        accounts = {
            app: appProvider,
            dataset: datasetProvider,
            workerpool: scheduler,
            requester: requester,
        };

        await deployments.fixture();
        const proxyAddress = await getContractAddress('ERC1538Proxy');
        iexecCategoryManagementInstance = IexecOrderManagement__factory.connect(
            proxyAddress,
            anyone,
        );
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
        entriesAndRequester = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
            requester: requester.address,
        };
    });

    describe('MatchOrders', function () {
        it('Should match orders', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTag, {
                    app: appPrice,
                    dataset: datasetPrice,
                    workerpool: workerpoolPrice,
                });
            const callbackAddress = '0x00000000000000000000000000000000ca11bac6';
            requestOrder.beneficiary = beneficiary.address;
            requestOrder.callback = callbackAddress;
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                1; // volume
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(0);
            await getRlcAndDeposit(requester, dealPrice);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const stakeRatio = await iexecInstance.workerpool_stake_ratio();
            const oneTaskStake = stakeRatio.mul(workerpoolPrice).div(100);
            const schedulerStake = oneTaskStake.mul(volume);
            await getRlcAndDeposit(scheduler, schedulerStake);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(0);
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            await time.setNextBlockTimestamp(startTime);

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
                    dealTag,
                    requestOrder.params,
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
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.appOwner).to.be.equal(appProvider.address);
            expect(deal.appPrice).to.be.equal(appPrice);
            expect(deal.datasetOwner).to.be.equal(datasetProvider.address);
            expect(deal.datasetPrice).to.be.equal(datasetPrice);
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address);
            expect(deal.workerpoolPrice).to.be.equal(workerpoolPrice);
            expect(deal.requester).to.be.equal(requester.address);
            expect(deal.beneficiary).to.be.equal(beneficiary.address);
            expect(deal.deadline).to.be.equal(startTime + 7 * 300);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(1);
            expect(deal.shortTag).to.be.equal('0x000000000000000000000001');
            expect(deal.callback.toLowerCase()).to.be.equal(callbackAddress);
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(
                schedulerStake.add(dealPrice),
            );
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
        });
    });

    // TODO: Move to MatchOrders block
    it('Should match orders with pre-signatures', async function () {
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            entriesAndRequester,
            dealTag,
        );
        await iexecCategoryManagementInstance.connect(appProvider).manageAppOrder({
            order: appOrder,
            operation: 0,
            sign: '0x',
        });
        await iexecCategoryManagementInstance.connect(datasetProvider).manageDatasetOrder({
            order: datasetOrder,
            operation: 0,
            sign: '0x',
        });
        await iexecCategoryManagementInstance.connect(scheduler).manageWorkerpoolOrder({
            order: workerpoolOrder,
            operation: 0,
            sign: '0x',
        });
        await iexecCategoryManagementInstance.connect(requester).manageRequestOrder({
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
                dealTag,
                requestOrder.params,
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

    describe('PushResult', function () {
        it('Should push result (TEE & callback)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTag);
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            requestOrder.callback = oracleConsumerInstance.address;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const schedulerSignature = await buildAndSignSchedulerMessage(
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

        it('Should push result (TEE)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTag);
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const schedulerSignature = await buildAndSignSchedulerMessage(
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
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });
    });

    describe('Claim', function () {
        it('Should claim', async function () {
            const zeroWorkerpoolPrice = 0;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTag, {
                    app: appPrice,
                    dataset: datasetPrice,
                    workerpool: zeroWorkerpoolPrice,
                });
            const dealPrice = appPrice + datasetPrice + zeroWorkerpoolPrice;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await getRlcAndDeposit(requester, dealPrice);
            await time.setNextBlockTimestamp(startTime);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(dealPrice);
            await time.setNextBlockTimestamp(startTime + 7 * 300);

            await expect(iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);
            expect((await iexecInstance.viewTask(taskId)).status).to.equal(4); // FAILED
            expect(await iexecInstance.balanceOf(iexecInstance.address)).to.be.equal(0);
            expect(await iexecInstance.balanceOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecInstance.frozenOf(requester.address)).to.be.equal(0);
        });
    });

    /**
     * Transfer RLC from owner to recipient and deposit recipient value on iExec.
     * @param value The value to deposit.
     * @param account Deposit value for an account.
     */
    async function getRlcAndDeposit(account: SignerWithAddress, value: number | BigNumber) {
        await rlcInstance.transfer(account.address, value);
        await rlcInstance
            .connect(account)
            .approveAndCall(iexecPocoBoostInstance.address, value, '0x');
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
