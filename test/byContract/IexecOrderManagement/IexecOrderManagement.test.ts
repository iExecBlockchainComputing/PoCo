// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
} from '../../../typechain';
import { NULL } from '../../../utils/constants';
import { buildOrders, createOrderOperation } from '../../../utils/createOrders';
import { OrderOperationEnum, getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const volume = 3;
const someSignature = ethers.utils.hexZeroPad('0x1', 65); // non empty signature

describe('OrderManagement', async () => {
    let proxyAddress: string;
    let [
        iexecPoco,
        iexecPocoAsAppProvider,
        iexecPocoAsDatasetProvider,
        iexecPocoAsScheduler,
        iexecPocoAsRequester,
    ]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [anyone, appProvider, datasetProvider, scheduler, requester]: SignerWithAddress[] = [];
    let appOrder: IexecLibOrders_v5.AppOrderStruct;
    let datasetOrder: IexecLibOrders_v5.DatasetOrderStruct;
    let workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct;
    let requestOrder: IexecLibOrders_v5.RequestOrderStruct;
    let [appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash]: string[] = [];

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ appProvider, datasetProvider, scheduler, requester, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        const { appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets();
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsAppProvider = iexecPoco.connect(appProvider);
        iexecPocoAsDatasetProvider = iexecPoco.connect(datasetProvider);
        iexecPocoAsScheduler = iexecPoco.connect(scheduler);
        iexecPocoAsRequester = iexecPoco.connect(requester);
        const appPrice = 1000;
        const datasetPrice = 1_000_000;
        const workerpoolPrice = 1_000_000_000;
        const ordersAssets = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
        };
        const ordersPrices = {
            app: appPrice,
            dataset: datasetPrice,
            workerpool: workerpoolPrice,
        };
        ({ appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume,
        }));
        appOrderHash = iexecWrapper.hashOrder(appOrder);
        datasetOrderHash = iexecWrapper.hashOrder(datasetOrder);
        workerpoolOrderHash = iexecWrapper.hashOrder(workerpoolOrder);
        requestOrderHash = iexecWrapper.hashOrder(requestOrder);
    }

    describe('Presign orders when operations are sent by owners', () => {
        it('Should presign app order when operation is sent by app provider', async () => {
            await expect(
                iexecPocoAsAppProvider.manageAppOrder(
                    createOrderOperation(appOrder, OrderOperationEnum.SIGN),
                ),
            )
                .to.emit(iexecPoco, 'SignedAppOrder')
                .withArgs(appOrderHash);
            expect(await iexecPoco.viewPresigned(appOrderHash)).equal(appProvider.address);
            expect(await iexecPoco.verifyPresignature(appProvider.address, appOrderHash)).is.true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    appProvider.address,
                    appOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign dataset order when operation is sent by dataset provider', async () => {
            await expect(
                iexecPocoAsDatasetProvider.manageDatasetOrder(
                    createOrderOperation(datasetOrder, OrderOperationEnum.SIGN),
                ),
            )
                .to.emit(iexecPoco, 'SignedDatasetOrder')
                .withArgs(datasetOrderHash);
            expect(await iexecPoco.viewPresigned(datasetOrderHash)).equal(datasetProvider.address);
            expect(await iexecPoco.verifyPresignature(datasetProvider.address, datasetOrderHash)).is
                .true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    datasetProvider.address,
                    datasetOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign workerpool order when operation is sent by scheduler', async () => {
            await expect(
                iexecPocoAsScheduler.manageWorkerpoolOrder(
                    createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN),
                ),
            )
                .to.emit(iexecPoco, 'SignedWorkerpoolOrder')
                .withArgs(workerpoolOrderHash);
            expect(await iexecPoco.viewPresigned(workerpoolOrderHash)).equal(scheduler.address);
            expect(await iexecPoco.verifyPresignature(scheduler.address, workerpoolOrderHash)).is
                .true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    scheduler.address,
                    workerpoolOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign request order when operation is sent by requester', async () => {
            await expect(
                iexecPocoAsRequester.manageRequestOrder(
                    createOrderOperation(requestOrder, OrderOperationEnum.SIGN),
                ),
            )
                .to.emit(iexecPoco, 'SignedRequestOrder')
                .withArgs(requestOrderHash);
            expect(await iexecPoco.viewPresigned(requestOrderHash)).equal(requester.address);
            expect(await iexecPoco.verifyPresignature(requester.address, requestOrderHash)).is.true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    requester.address,
                    requestOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
    });

    describe('Presign orders when operations are signed by owners', () => {
        it('Should presign app order when operation is signed by app provider', async () => {
            const orderOperation = createOrderOperation(appOrder, OrderOperationEnum.SIGN);
            await iexecWrapper.signOrderOperation(orderOperation, appProvider);

            await expect(iexecPoco.manageAppOrder(orderOperation))
                .to.emit(iexecPoco, 'SignedAppOrder')
                .withArgs(appOrderHash);
            expect(await iexecPoco.viewPresigned(appOrderHash)).equal(appProvider.address);
            expect(await iexecPoco.verifyPresignature(appProvider.address, appOrderHash)).is.true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    appProvider.address,
                    appOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign dataset order when operation is signed by dataset provider', async () => {
            const orderOperation = createOrderOperation(datasetOrder, OrderOperationEnum.SIGN);
            await iexecWrapper.signOrderOperation(orderOperation, datasetProvider);

            await expect(iexecPoco.manageDatasetOrder(orderOperation))
                .to.emit(iexecPoco, 'SignedDatasetOrder')
                .withArgs(datasetOrderHash);
            expect(await iexecPoco.viewPresigned(datasetOrderHash)).equal(datasetProvider.address);
            expect(await iexecPoco.verifyPresignature(datasetProvider.address, datasetOrderHash)).is
                .true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    datasetProvider.address,
                    datasetOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign workerpool order when operation is signed by workerpool provider', async () => {
            const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
            await iexecWrapper.signOrderOperation(orderOperation, scheduler);

            await expect(iexecPoco.manageWorkerpoolOrder(orderOperation))
                .to.emit(iexecPoco, 'SignedWorkerpoolOrder')
                .withArgs(workerpoolOrderHash);
            expect(await iexecPoco.viewPresigned(workerpoolOrderHash)).equal(scheduler.address);
            expect(await iexecPoco.verifyPresignature(scheduler.address, workerpoolOrderHash)).is
                .true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    scheduler.address,
                    workerpoolOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
        it('Should presign request order when operation is signed by requester', async () => {
            const orderOperation = createOrderOperation(requestOrder, OrderOperationEnum.SIGN);
            await iexecWrapper.signOrderOperation(orderOperation, requester);

            await expect(iexecPoco.manageRequestOrder(orderOperation))
                .to.emit(iexecPoco, 'SignedRequestOrder')
                .withArgs(requestOrderHash);
            expect(await iexecPoco.viewPresigned(requestOrderHash)).equal(requester.address);
            expect(await iexecPoco.verifyPresignature(requester.address, requestOrderHash)).is.true;
            expect(
                await iexecPoco.verifyPresignatureOrSignature(
                    requester.address,
                    requestOrderHash,
                    NULL.SIGNATURE,
                ),
            ).is.true;
        });
    });

    describe('Close orders when operations are sent by owners', () => {
        it('Should close app order when operation is sent by app provider', async () => {
            await expect(
                iexecPocoAsAppProvider.manageAppOrder(
                    createOrderOperation(appOrder, OrderOperationEnum.CLOSE),
                ),
            )
                .to.emit(iexecPoco, 'ClosedAppOrder')
                .withArgs(appOrderHash);
            expect(await iexecPoco.viewConsumed(appOrderHash)).equal(volume);
        });
        it('Should close dataset order when operation is sent by dataset provider', async () => {
            await expect(
                iexecPocoAsDatasetProvider.manageDatasetOrder(
                    createOrderOperation(datasetOrder, OrderOperationEnum.CLOSE),
                ),
            )
                .to.emit(iexecPoco, 'ClosedDatasetOrder')
                .withArgs(datasetOrderHash);
            expect(await iexecPoco.viewConsumed(datasetOrderHash)).equal(volume);
        });
        it('Should close workerpool order when operation is sent by scheduler', async () => {
            await expect(
                iexecPocoAsScheduler.manageWorkerpoolOrder(
                    createOrderOperation(workerpoolOrder, OrderOperationEnum.CLOSE),
                ),
            )
                .to.emit(iexecPoco, 'ClosedWorkerpoolOrder')
                .withArgs(workerpoolOrderHash);
            expect(await iexecPoco.viewConsumed(workerpoolOrderHash)).equal(volume);
        });
        it('Should close request order when operation is sent by requester', async () => {
            await expect(
                iexecPocoAsRequester.manageRequestOrder(
                    createOrderOperation(requestOrder, OrderOperationEnum.CLOSE),
                ),
            )
                .to.emit(iexecPoco, 'ClosedRequestOrder')
                .withArgs(requestOrderHash);
            expect(await iexecPoco.viewConsumed(requestOrderHash)).equal(volume);
        });
    });

    describe('Close orders when operations are signed by owners', () => {
        it('Should close app order when operation is signed by app provider', async () => {
            const orderOperation = createOrderOperation(appOrder, OrderOperationEnum.CLOSE);
            await iexecWrapper.signOrderOperation(orderOperation, appProvider);

            await expect(iexecPoco.manageAppOrder(orderOperation))
                .to.emit(iexecPoco, 'ClosedAppOrder')
                .withArgs(appOrderHash);
            expect(await iexecPoco.viewConsumed(appOrderHash)).equal(volume);
        });
        it('Should close dataset order when operation is signed by dataset provider', async () => {
            const orderOperation = createOrderOperation(datasetOrder, OrderOperationEnum.CLOSE);
            await iexecWrapper.signOrderOperation(orderOperation, datasetProvider);

            await expect(iexecPoco.manageDatasetOrder(orderOperation))
                .to.emit(iexecPoco, 'ClosedDatasetOrder')
                .withArgs(datasetOrderHash);
            expect(await iexecPoco.viewConsumed(datasetOrderHash)).equal(volume);
        });
        it('Should close workerpool order when operation is signed by scheduler', async () => {
            const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.CLOSE);
            await iexecWrapper.signOrderOperation(orderOperation, scheduler);

            await expect(iexecPoco.manageWorkerpoolOrder(orderOperation))
                .to.emit(iexecPoco, 'ClosedWorkerpoolOrder')
                .withArgs(workerpoolOrderHash);
            expect(await iexecPoco.viewConsumed(workerpoolOrderHash)).equal(volume);
        });
        it('Should close request order when operation is signed by requester', async () => {
            const orderOperation = createOrderOperation(requestOrder, OrderOperationEnum.CLOSE);
            await iexecWrapper.signOrderOperation(orderOperation, requester);

            await expect(iexecPoco.manageRequestOrder(orderOperation))
                .to.emit(iexecPoco, 'ClosedRequestOrder')
                .withArgs(requestOrderHash);
            expect(await iexecPoco.viewConsumed(requestOrderHash)).equal(volume);
        });
    });

    describe('Should not manage orders when invalid sender or signature', () => {
        it('Should not manage app order when invalid sender or signature', async () => {
            await expect(
                iexecPoco.manageAppOrder({
                    order: appOrder,
                    operation: OrderOperationEnum.SIGN, // any is fine
                    sign: someSignature,
                }),
            ).to.be.revertedWith('invalid-sender-or-signature');
        });
        it('Should not manage dataset order when invalid sender or signature', async () => {
            await expect(
                iexecPoco.manageDatasetOrder({
                    order: datasetOrder,
                    operation: OrderOperationEnum.SIGN, // any is fine
                    sign: someSignature,
                }),
            ).to.be.revertedWith('invalid-sender-or-signature');
        });
        it('Should not manage workerpool order when invalid sender or signature', async () => {
            await expect(
                iexecPoco.manageWorkerpoolOrder({
                    order: workerpoolOrder,
                    operation: OrderOperationEnum.SIGN, // any is fine
                    sign: someSignature,
                }),
            ).to.be.revertedWith('invalid-sender-or-signature');
        });
        it('Should not manage request order when invalid sender or signature', async () => {
            await expect(
                iexecPoco.manageRequestOrder({
                    order: requestOrder,
                    operation: OrderOperationEnum.SIGN, // any is fine
                    sign: someSignature,
                }),
            ).to.be.revertedWith('invalid-sender-or-signature');
        });
    });
});
