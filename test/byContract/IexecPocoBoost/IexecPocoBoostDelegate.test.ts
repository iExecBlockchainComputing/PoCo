import { smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import {
    IexecPocoBoostDelegate__factory,
    IexecPocoBoostDelegate,
    App__factory,
    Workerpool__factory,
    Dataset__factory,
} from '../../../typechain';
import constants from '../../../utils/constants';
import { buildCompatibleOrders } from '../../../utils/createOrders';
import {
    buildAndSignSchedulerMessage,
    buildUtf8ResultAndDigest,
    buildAndSignEnclaveMessage,
    getTaskId,
} from '../../../utils/poco-tools';

const dealId = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const taskId = '0xae9e915aaf14fdf170c136ab81636f27228ed29f8d58ef7c714a53e57ce0c884';
const { results, resultDigest } = buildUtf8ResultAndDigest('result');

async function deployBoostFixture() {
    const [
        admin,
        requester,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
        worker2,
        enclave,
        anyone,
    ] = await ethers.getSigners();
    const iexecPocoBoostInstance: IexecPocoBoostDelegate =
        await new IexecPocoBoostDelegate__factory()
            .connect(admin)
            .deploy()
            .then((instance) => instance.deployed());

    return {
        iexecPocoBoostInstance,
        admin,
        requester,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker: worker1,
        worker1,
        worker2,
        enclave,
        anyone,
    };
}

async function createMock<T extends ContractFactory>(contractName: string): Promise<Contract> {
    return await smock
        .mock<T>(contractName)
        .then((contract) => contract.deploy())
        .then((instance) => instance.deployed());
}

describe('IexecPocoBoostDelegate', function () {
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let appInstance: Contract;
    let workerpoolInstance: Contract;
    let datasetInstance: Contract;
    let [appProvider, datasetProvider, scheduler, worker, enclave, requester, beneficiary, anyone] =
        [] as SignerWithAddress[];

    beforeEach('set up contract instances and mock app', async () => {
        const fixtures = await loadFixture(deployBoostFixture);
        iexecPocoBoostInstance = fixtures.iexecPocoBoostInstance;
        appProvider = fixtures.appProvider;
        datasetProvider = fixtures.datasetProvider;
        scheduler = fixtures.scheduler;
        worker = fixtures.worker;
        enclave = fixtures.enclave;
        requester = fixtures.requester;
        beneficiary = fixtures.beneficiary;
        anyone = fixtures.anyone;
        appInstance = await createMock<App__factory>('App');
        workerpoolInstance = await createMock<Workerpool__factory>('Workerpool');
        datasetInstance = await createMock<Dataset__factory>('Dataset');
    });

    describe('Match Orders Boost', function () {
        it('Should match orders', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const dealId = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
            const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
            const nonZeroAppPrice = 3000;
            const nonZeroDatasetPrice = 900546000;
            const nonZeroWorkerpoolPrice = 569872878;

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );

            requestOrder.requester = requester.address;
            requestOrder.beneficiary = beneficiary.address;
            // Set prices
            appOrder.appprice = nonZeroAppPrice;
            requestOrder.appmaxprice = nonZeroAppPrice;

            datasetOrder.datasetprice = nonZeroDatasetPrice;
            requestOrder.datasetmaxprice = nonZeroDatasetPrice;

            workerpoolOrder.workerpoolprice = nonZeroWorkerpoolPrice;
            requestOrder.workerpoolmaxprice = nonZeroWorkerpoolPrice;

            // Set callback
            requestOrder.callback = ethers.Wallet.createRandom().address;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealId);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester, 'Requester mismatch');
            expect(deal.appOwner).to.be.equal(appProvider.address, 'App owner mismatch');
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address, 'Workerpool owner mismatch');
            expect(deal.beneficiary).to.be.equal(requestOrder.beneficiary, 'Beneficiary mismatch');
            expect(deal.callback).to.be.equal(requestOrder.callback, 'Callback mismatch');
            // Check prices.
            expect(deal.workerpoolPrice).to.be.equal(
                workerpoolOrder.workerpoolprice,
                'Workerpool price mismatch',
            );
            expect(deal.appPrice).to.be.equal(appOrder.appprice, 'App price mismatch');
            expect(deal.datasetPrice).to.be.equal(datasetOrder.datasetprice, 'Dataset price mismatch');
            expect(deal.tag).to.be.equal(dealTag);
        });

        it('Should fail when trust is not zero', async function () {
            const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );
            // Set non-zero trust
            requestOrder.trust = 1;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Non-zero trust level');
        });

        it('Should fail when categories are different', async function () {
            const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );
            // Set different categories
            requestOrder.category = 1;
            workerpoolOrder.category = 2;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Category mismatch');
        });

        it('Should fail when app max price is less than app price', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );
            appOrder.appprice = 200;
            requestOrder.appmaxprice = 100;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Overpriced app');
        });

        it('Should fail when dataset max price is less than dataset price', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );

            // Set dataset price higher than dataset max price
            datasetOrder.datasetprice = 300;
            requestOrder.datasetmaxprice = 200;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Overpriced dataset');
        });

        it('Should fail when workerpool max price is less than workerpool price', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTag,
            );

            // Set workerpool price higher than workerpool max price
            workerpoolOrder.workerpoolprice = 400;
            requestOrder.workerpoolmaxprice = 300;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Overpriced workerpool');
        });
    });

    describe('Push Result Boost', function () {
    //TODO: Re-indent block
    it('Should push result (TEE)', async function () {
        appInstance.owner.returns(appProvider.address);
        workerpoolInstance.owner.returns(scheduler.address);
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            appInstance.address,
            workerpoolInstance.address,
            datasetInstance.address,
            dealTag,
        );
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
                    schedulerSignature,
                    enclave.address,
                    enclaveSignature,
                ),
        )
            .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
            .withArgs(dealId, taskIndex, results);
    });

    it('Should push result (Standard)', async function () {
        appInstance.owner.returns(appProvider.address);
        workerpoolInstance.owner.returns(scheduler.address);
        const tag = constants.NULL.BYTES32;
        const dealId = '0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5';
        const taskId = getTaskId(dealId, taskIndex);
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            appInstance.address,
            workerpoolInstance.address,
            datasetInstance.address,
            tag,
        );
        await iexecPocoBoostInstance.matchOrdersBoost(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder,
        );
        const emptyEnclaveAddress = constants.NULL.ADDRESS;
        const schedulerSignature = await buildAndSignSchedulerMessage(
            worker.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );

        await expect(
            iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    schedulerSignature,
                    emptyEnclaveAddress,
                    constants.NULL.SIGNATURE,
                ),
        )
            .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
            .withArgs(dealId, taskIndex, results);
    });

    it('Should not push result with invalid scheduler signature', async function () {
        appInstance.owner.returns(appProvider.address);
        workerpoolInstance.owner.returns(scheduler.address);
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            appInstance.address,
            workerpoolInstance.address,
            datasetInstance.address,
            dealTag,
        );
        await iexecPocoBoostInstance.matchOrdersBoost(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder,
        );
        const anyoneSignature = anyone.signMessage(constants.NULL.BYTES32);

        await expect(
            iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    anyoneSignature,
                    enclave.address,
                    constants.NULL.SIGNATURE,
                ),
        ).to.be.revertedWith('PocoBoost: Invalid scheduler signature');
    });

    it('Should not push result with invalid enclave signature', async function () {
        appInstance.owner.returns(appProvider.address);
        workerpoolInstance.owner.returns(scheduler.address);
        const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
            appInstance.address,
            workerpoolInstance.address,
            datasetInstance.address,
            dealTag,
        );
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
        const anyoneSignature = anyone.signMessage(constants.NULL.BYTES32);

        await expect(
            iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    schedulerSignature,
                    enclave.address,
                    anyoneSignature,
                ),
        ).to.be.revertedWith('PocoBoost: Invalid enclave signature');
    });
    });
});
