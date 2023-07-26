import { MockContract, smock } from '@defi-wonderland/smock';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import {
    IexecPocoBoostDelegate__factory,
    IexecPocoBoostDelegate,
    App__factory,
    Workerpool__factory,
    Dataset__factory,
    TestClient,
    TestClient__factory,
    IexecLibOrders_v5__factory,
    App,
    Workerpool,
    Dataset,
} from '../../../typechain';
import constants from '../../../utils/constants';
import {
    buildCompatibleOrders,
    buildDomain,
    signOrder,
    hashOrder,
} from '../../../utils/createOrders';
import {
    buildAndSignSchedulerMessage,
    buildUtf8ResultAndDigest,
    buildResultCallbackAndDigest,
    buildAndSignEnclaveMessage,
    getTaskId,
} from '../../../utils/poco-tools';

chai.use(smock.matchers);

const dealIdTee = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
const dealTagTee = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const taskId = '0xae9e915aaf14fdf170c136ab81636f27228ed29f8d58ef7c714a53e57ce0c884';
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const EIP712DOMAIN_SEPARATOR = 'EIP712DOMAIN_SEPARATOR';
const { domain, domainSeparator } = buildDomain();

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
    const iexecLibOrdersInstanceAddress = await new IexecLibOrders_v5__factory()
        .connect(admin)
        .deploy()
        .then((instance) => instance.deployed())
        .then((instance) => instance.address);
    // Using native smock call here for understandability purposes (also works with
    // the custom `createMock` method)
    const iexecPocoBoostInstance = (await smock
        .mock<IexecPocoBoostDelegate__factory>('IexecPocoBoostDelegate', {
            libraries: {
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    iexecLibOrdersInstanceAddress,
            },
        })
        .then((instance) => instance.deploy())
        .then((instance) => instance.deployed())) as MockContract<IexecPocoBoostDelegate>;
    // A global domain separator needs to be set since current contract is being
    // unit tested here (hence no proxy)
    await iexecPocoBoostInstance.setVariable(EIP712DOMAIN_SEPARATOR, domainSeparator);
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

async function createMock<CF extends ContractFactory, C extends Contract>(
    contractName: string,
    factoryOptions?: FactoryOptions,
    ...args: Parameters<CF['deploy']>
): Promise<MockContract<C>> {
    return (await smock
        .mock<CF>(contractName, factoryOptions)
        .then((contract) => contract.deploy(...args))
        .then((instance) => instance.deployed())) as MockContract<C>;
}

describe('IexecPocoBoostDelegate', function () {
    let iexecPocoBoostInstance: MockContract<IexecPocoBoostDelegate>;
    let appInstance: MockContract<App>;
    let workerpoolInstance: MockContract<Workerpool>;
    let datasetInstance: MockContract<Dataset>;
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
        appInstance = await createMock<App__factory, App>('App');
        workerpoolInstance = await createMock<Workerpool__factory, Workerpool>('Workerpool');
        datasetInstance = await createMock<Dataset__factory, Dataset>('Dataset');
    });

    describe('Match Orders Boost', function () {
        it('Should match orders', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const nonZeroAppPrice = 3000;
            const nonZeroDatasetPrice = 900546000;
            const nonZeroWorkerpoolPrice = 569872878;

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
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
            await signOrder(domain, appOrder, appProvider);

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
                    workerpoolInstance.address,
                    dealIdTee,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealIdTee, hashOrder(domain, appOrder));
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealIdTee);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester, 'Requester mismatch');
            expect(deal.appOwner).to.be.equal(appProvider.address, 'App owner mismatch');
            expect(deal.workerpoolOwner).to.be.equal(
                scheduler.address,
                'Workerpool owner mismatch',
            );
            expect(deal.beneficiary).to.be.equal(requestOrder.beneficiary, 'Beneficiary mismatch');
            expect(deal.callback).to.be.equal(requestOrder.callback, 'Callback mismatch');
            // Check prices.
            expect(deal.workerpoolPrice).to.be.equal(
                workerpoolOrder.workerpoolprice,
                'Workerpool price mismatch',
            );
            expect(deal.appPrice).to.be.equal(appOrder.appprice, 'App price mismatch');
            expect(deal.datasetPrice).to.be.equal(
                datasetOrder.datasetprice,
                'Dataset price mismatch',
            );
            expect(deal.tag).to.be.equal(dealTagTee);
        });

        it('Should match orders with pre-signatures', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            const appOrderHash = hashOrder(domain, appOrder);
            await iexecPocoBoostInstance.setVariable('m_presigned', {
                [appOrderHash]: appProvider.address,
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
                    workerpoolInstance.address,
                    dealIdTee,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealIdTee, appOrderHash);
        });

        it('Should match orders without dataset', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);

            const nonZeroAppPrice = 3000;
            const nonZeroDatasetPrice = 900546000;
            const nonZeroWorkerpoolPrice = 569872878;

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                constants.NULL.ADDRESS, // No dataset.
                dealTagTee,
            );

            requestOrder.requester = requester.address;
            requestOrder.beneficiary = beneficiary.address;
            // Set prices
            appOrder.appprice = nonZeroAppPrice;
            requestOrder.appmaxprice = nonZeroAppPrice;

            workerpoolOrder.workerpoolprice = nonZeroWorkerpoolPrice;
            requestOrder.workerpoolmaxprice = nonZeroWorkerpoolPrice;

            // Set callback
            requestOrder.callback = ethers.Wallet.createRandom().address;
            await signOrder(domain, appOrder, appProvider);

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
                    workerpoolInstance.address,
                    dealIdTee,
                    appInstance.address,
                    constants.NULL.ADDRESS, // No dataset.
                    requestOrder.category,
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
                .withArgs(dealIdTee, hashOrder(domain, appOrder));
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealIdTee);
            expect(deal.datasetPrice).to.be.equal(0);
        });

        it('Should fail when trust is not zero', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
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
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
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
                dealTagTee,
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
                dealTagTee,
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
                dealTagTee,
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

        it('Should fail when invalid app order signature', async function () {
            appInstance.owner.returns(appProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            await signOrder(domain, appOrder, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Invalid app order signature');
        });

        it('Should fail when the workerpool tag does not provide what app, dataset and request expect', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            // Manually set the tags for app, dataset, and request orders
            appOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000001'; // 0b0001
            datasetOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            requestOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011

            // Set the workerpool tag to a different value
            workerpoolOrder.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000004'; // 0b0100

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Workerpool tag does not match demand');
        });

        it('Should fail when the last bit of app tag does not provide what dataset or request expect', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );

            // Manually set the tags for app, dataset, and request orders
            // The last bit of dataset and request tag is 1, but app tag does not set it
            appOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            datasetOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            requestOrder.tag = '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011

            // Set the workerpool tag to pass first tag check
            workerpoolOrder.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: App tag does not match demand');
        });
    });

    describe('Push Result Boost', function () {
        beforeEach('mock app, dataset and workerpool', async () => {
            // Mock app, dataset and workerpool here before each test so
            // matchOrdersBoost setup will be lighter when unit testing
            // pushResultBoost
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
        });

        it('Should push result (TEE & callback)', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            const oracleConsumerInstance = await createMock<TestClient__factory, TestClient>(
                'TestClient',
            );
            requestOrder.callback = oracleConsumerInstance.address;
            await signOrder(domain, appOrder, appProvider);
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
                        dealIdTee,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealIdTee, taskIndex, results);
            expect(oracleConsumerInstance.receiveResult).to.have.been.calledWith(
                taskId,
                resultsCallback,
            );
        });

        it('Should push result (TEE)', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
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
                        dealIdTee,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealIdTee, taskIndex, results);
        });

        it('Should push result (Standard)', async function () {
            const tag = constants.NULL.BYTES32;
            const dealIdStandard =
                '0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5';
            const taskId = getTaskId(dealIdStandard, taskIndex);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                tag,
            );
            await signOrder(domain, appOrder, appProvider);
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
                        dealIdStandard,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        emptyEnclaveAddress,
                        constants.NULL.SIGNATURE,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealIdStandard, taskIndex, results);
        });

        it('Should not push result with invalid scheduler signature', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
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
                        dealIdTee,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        anyoneSignature,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid scheduler signature');
        });

        it('Should not push result with invalid enclave signature', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
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
                        dealIdTee,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        anyoneSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid enclave signature');
        });

        it('Should not push result with missing data for callback', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                appInstance.address,
                workerpoolInstance.address,
                datasetInstance.address,
                dealTagTee,
            );
            requestOrder.callback = '0x000000000000000000000000000000000000ca11';
            await signOrder(domain, appOrder, appProvider);
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
            const resultsCallback = '0x';
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                ethers.utils.keccak256(resultsCallback),
                enclave,
            );

            expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealIdTee,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Callback requires data');
        });
    });
});
