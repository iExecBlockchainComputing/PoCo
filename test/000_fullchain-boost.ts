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
import {
    IexecPocoBoostDelegate__factory,
    IexecPocoBoostDelegate,
    AppRegistry__factory,
    AppRegistry,
    WorkerpoolRegistry__factory,
    WorkerpoolRegistry,
} from '../typechain';
import constants from '../utils/constants';
import { extractEventsFromReceipt } from '../utils/tools';
import { buildCompatibleOrders } from '../utils/createOrders';
import { buildAndSignSchedulerMessage } from '../utils/poco-tools';

const dealId = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const taskId = '0xae9e915aaf14fdf170c136ab81636f27228ed29f8d58ef7c714a53e57ce0c884';
const result: string = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('the-result'));

describe('IexecPocoBoostDelegate', function () {
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let appAddress = '';
    let workerpoolAddress = '';
    let [scheduler, worker, enclave] = [] as SignerWithAddress[];
    beforeEach('Deploy IexecPocoBoostDelegate', async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        const [owner, appProvider, _scheduler, _worker, _enclave] = await hre.ethers.getSigners();
        scheduler = _scheduler;
        worker = _worker;
        enclave = _enclave;

        await deployments.fixture();
        iexecPocoBoostInstance = IexecPocoBoostDelegate__factory.connect(
            (await deployments.get('IexecPocoBoostDelegate')).address,
            owner,
        );

        const appRegistryInstance: AppRegistry = AppRegistry__factory.connect(
            await getContractAddress('AppRegistry'),
            owner,
        );
        const receipt = await appRegistryInstance
            .createApp(
                appProvider.address,
                'my-app',
                'APP_TYPE_0',
                constants.NULL.BYTES32,
                constants.NULL.BYTES32,
                constants.NULL.BYTES32,
            )
            .then((tx) => tx.wait());
        const events = extractEventsFromReceipt(receipt, appRegistryInstance.address, 'Transfer');
        appAddress = events[0].args['tokenId'].toHexString();

        const workerpoolRegistryInstance: WorkerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await getContractAddress('WorkerpoolRegistry'),
            owner,
        );
        const poolReceipt = await workerpoolRegistryInstance
            .createWorkerpool(scheduler.address, 'my-workerpool')
            .then((tx) => tx.wait());
        const poolEvents = extractEventsFromReceipt(
            poolReceipt,
            workerpoolRegistryInstance.address,
            'Transfer',
        );
        workerpoolAddress = poolEvents[0].args['tokenId'].toHexString();
    });

    describe('MatchOrders', function () {
        it('Should match orders', async function () {
            const { appOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appAddress,
                workerpoolAddress,
                dealTag,
            );
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(appOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealId);
        });
    });

    describe('PushResult', function () {
        it('Should push result', async function () {
            const { appOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appAddress,
                workerpoolAddress,
                dealTag,
            );
            await iexecPocoBoostInstance.matchOrdersBoost(appOrder, workerpoolOrder, requestOrder);

            const schedulerSignature = await buildAndSignSchedulerMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        result,
                        schedulerSignature,
                        enclave.address,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, result);
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
