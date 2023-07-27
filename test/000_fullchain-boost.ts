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
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain } from 'ethers';
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
} from '../typechain';
import constants from '../utils/constants';
import { extractEventsFromReceipt } from '../utils/tools';
import { ContractReceipt } from '@ethersproject/contracts';

import { IexecAccounts, buildCompatibleOrders, hashOrder, signOrders } from '../utils/createOrders';
import {
    buildAndSignSchedulerMessage,
    buildUtf8ResultAndDigest,
    buildResultCallbackAndDigest,
    buildAndSignEnclaveMessage,
} from '../utils/poco-tools';

const dealId = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const taskId = '0xae9e915aaf14fdf170c136ab81636f27228ed29f8d58ef7c714a53e57ce0c884';
const { results, resultDigest } = buildUtf8ResultAndDigest('result');

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
    let iexecCategoryManagementInstance: IexecOrderManagement;
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let appAddress = '';
    let workerpoolAddress = '';
    let datasetAddress = '';
    let [requester, appProvider, datasetProvider, scheduler, worker, enclave, anyone] =
        [] as SignerWithAddress[];
    let accounts: IexecAccounts;
    beforeEach('Deploy IexecPocoBoostDelegate', async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        let signers = await hre.ethers.getSigners();
        const owner = signers[0];
        requester = signers[1];
        appProvider = signers[2];
        datasetProvider = signers[3];
        scheduler = signers[4];
        worker = signers[5];
        enclave = signers[6];
        anyone = signers[7];
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
    });

    describe('MatchOrders', function () {
        it('Should match orders', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(appAddress, workerpoolAddress, datasetAddress, dealTag);
            await signOrders(domain, orders, accounts);
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
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealId, hashOrder(domain, appOrder), hashOrder(domain, datasetOrder));
        });
    });

    // TODO: Move to MatchOrders block
    it('Should match orders with pre-signatures', async function () {
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            appAddress,
            workerpoolAddress,
            datasetAddress,
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
                requestOrder.params,
            )
            .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
            .withArgs(dealId, hashOrder(domain, appOrder), hashOrder(domain, datasetOrder));
    });

    describe('PushResult', function () {
        it('Should push result (TEE & callback)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(appAddress, workerpoolAddress, datasetAddress, dealTag);
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            requestOrder.callback = oracleConsumerInstance.address;
            await signOrders(domain, orders, accounts);
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
            expect(await oracleConsumerInstance.store(taskId)).to.be.equal(resultsCallback);
        });

        it('Should push result (TEE)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(appAddress, workerpoolAddress, datasetAddress, dealTag);
            await signOrders(domain, orders, accounts);
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
