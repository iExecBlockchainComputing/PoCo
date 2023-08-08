import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import chai, { expect } from 'chai';
import { assert, ethers } from 'hardhat';
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
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
} from '../../../typechain';
import constants from '../../../utils/constants';
import {
    buildCompatibleOrders,
    buildDomain,
    signOrder,
    hashOrder,
    signOrders,
    Iexec,
    IexecAccounts,
    createEmptyWorkerpoolOrder,
} from '../../../utils/createOrders';
import {
    buildAndSignSchedulerMessage,
    buildUtf8ResultAndDigest,
    buildResultCallbackAndDigest,
    buildAndSignEnclaveMessage,
    getTaskId,
    getDealId,
} from '../../../utils/poco-tools';

chai.use(smock.matchers);

const dealTagTee = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
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
    await iexecPocoBoostInstance.setVariable('m_categories', [
        {
            // Category 0
            name: 'some-name',
            description: 'some-description',
            workClockTimeRef: 60,
        },
    ]);
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
    let appRegistry: FakeContract<AppRegistry>;
    let datasetRegistry: FakeContract<DatasetRegistry>;
    let workerpoolRegistry: FakeContract<WorkerpoolRegistry>;
    let [appProvider, datasetProvider, scheduler, worker, enclave, requester, beneficiary, anyone] =
        [] as SignerWithAddress[];
    let accounts: IexecAccounts;
    let entriesAndRequester: Iexec<string>;

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
        accounts = {
            app: appProvider,
            dataset: datasetProvider,
            workerpool: scheduler,
            requester: requester,
        };
        appInstance = await createMock<App__factory, App>('App');
        workerpoolInstance = await createMock<Workerpool__factory, Workerpool>('Workerpool');
        datasetInstance = await createMock<Dataset__factory, Dataset>('Dataset');
        entriesAndRequester = {
            app: appInstance.address,
            dataset: datasetInstance.address,
            workerpool: workerpoolInstance.address,
            requester: requester.address,
        };
        appRegistry = await smock.fake<AppRegistry>(AppRegistry__factory);
        await iexecPocoBoostInstance.setVariable('m_appregistry', appRegistry.address);
        datasetRegistry = await smock.fake<DatasetRegistry>(DatasetRegistry__factory);
        await iexecPocoBoostInstance.setVariable('m_datasetregistry', datasetRegistry.address);
        workerpoolRegistry = await smock.fake<WorkerpoolRegistry>(WorkerpoolRegistry__factory);
        await iexecPocoBoostInstance.setVariable(
            'm_workerpoolregistry',
            workerpoolRegistry.address,
        );

        appRegistry.isRegistered.whenCalledWith(appInstance.address).returns(true);
        datasetRegistry.isRegistered.whenCalledWith(datasetInstance.address).returns(true);
        workerpoolRegistry.isRegistered.whenCalledWith(workerpoolInstance.address).returns(true);
    });

    describe('Match Orders Boost', function () {
        it('Should match orders', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const nonZeroAppPrice = 3000;
            const nonZeroDatasetPrice = 900546000;
            const nonZeroWorkerpoolPrice = 569872878;

            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
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
            // Should match orders with low app order volume
            // Set volumes
            appOrder.volume = 2; // smallest unconsumed volume among all orders
            datasetOrder.volume = 3;
            workerpoolOrder.volume = 4;
            requestOrder.volume = 5;
            const expectedVolume = 2;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, undefined);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, undefined);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, undefined);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, undefined);

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
                    dealId,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, expectedVolume);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
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
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
            expect(deal.tag).to.be.equal(dealTagTee);
        });

        it('Should match orders with pre-signatures', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);
            await iexecPocoBoostInstance.setVariable('m_presigned', {
                [appOrderHash]: appProvider.address,
                [datasetOrderHash]: datasetProvider.address,
                [workerpoolOrderHash]: scheduler.address,
                [requestOrderHash]: requester.address,
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
                    workerpoolInstance.address,
                    dealId,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
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

        it('Should match orders without dataset', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);

            const nonZeroAppPrice = 3000;
            const nonZeroDatasetPrice = 900546000;
            const nonZeroWorkerpoolPrice = 569872878;

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                {
                    app: appInstance.address,
                    dataset: constants.NULL.ADDRESS, // No dataset.
                    workerpool: workerpoolInstance.address,
                    requester: requester.address,
                },
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
            await signOrder(domain, workerpoolOrder, scheduler);
            await signOrder(domain, requestOrder, requester);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, undefined);

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
                    dealId,
                    appInstance.address,
                    constants.NULL.ADDRESS, // No dataset.
                    requestOrder.category,
                    requestOrder.params,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    constants.NULL.BYTES32,
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                );
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, undefined);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.datasetPrice).to.be.equal(0);
        });

        it('Should match orders with low dataset order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            // Set volumes
            appOrder.volume = 6;
            datasetOrder.volume = 5; // smallest unconsumed volume among all orders
            workerpoolOrder.volume = 7;
            requestOrder.volume = 8;
            const expectedVolume = 5;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, expectedVolume);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders with low workerpool order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            // Set volumes
            appOrder.volume = 5;
            datasetOrder.volume = 4;
            workerpoolOrder.volume = 3; // smallest unconsumed volume among all orders
            requestOrder.volume = 6;
            const expectedVolume = 3;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, expectedVolume);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders partially with low request order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            // Set volumes
            appOrder.volume = 7;
            datasetOrder.volume = 6;
            workerpoolOrder.volume = 5;
            requestOrder.volume = 4; // smallest unconsumed volume among all orders
            const expectedVolume = 4;
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, expectedVolume);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match request order multiple times until fully consumed', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            appOrder.volume = 8;
            datasetOrder.volume = 8;
            requestOrder.volume = 8;
            // Partially consume orders in a first batch
            workerpoolOrder.volume = 3; // 3 now and 5 later
            await signOrders(domain, orders, accounts);
            const dealId1 = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId1,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    3,
                );
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId1);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(3);

            // Fully consume orders in a second and last batch
            const workerpoolOrder2 = workerpoolOrder;
            workerpoolOrder2.volume = 5;
            const workerpoolOrderHash2 = hashOrder(domain, workerpoolOrder2);
            await signOrder(domain, workerpoolOrder2, scheduler);
            const dealId2 = getDealId(domain, requestOrder, 3);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder2,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId2,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash2,
                    requestOrderHash,
                    5,
                );
            const deal2 = await iexecPocoBoostInstance.viewDealBoost(dealId2);
            expect(deal2.botFirst).to.be.equal(3); // next index after last task of deal1:{0, 1, 2}
            expect(deal2.botSize).to.be.equal(5);
            // Verify request is fully consumed
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, 8);
        });

        it('Should not match orders if one or more orders are consumed', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            // Set volumes
            appOrder.volume = 0; // nothing to consume
            await signOrders(domain, orders, accounts);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: One or more orders consumed');
        });

        it('Should fail when trust is not zero', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
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
                entriesAndRequester,
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

        it('Should fail when category unknown', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Unknown category
            requestOrder.category = 1;
            workerpoolOrder.category = 1;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Unknown category');
        });

        it('Should fail when app max price is less than app price', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
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
                entriesAndRequester,
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
                entriesAndRequester,
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
                entriesAndRequester,
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

        it('Should fail when invalid dataset order signature', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
            await signOrder(domain, datasetOrder, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Invalid dataset order signature');
        });

        it('Should fail when invalid workerpool order signature', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
            await signOrder(domain, datasetOrder, datasetProvider);
            await signOrder(domain, workerpoolOrder, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Invalid workerpool order signature');
        });

        it('Should fail when invalid request order signature', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            await signOrder(domain, appOrder, appProvider);
            await signOrder(domain, datasetOrder, datasetProvider);
            await signOrder(domain, workerpoolOrder, scheduler);
            await signOrder(domain, requestOrder, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Invalid request order signature');
        });

        it('Should fail when the workerpool tag does not provide what app, dataset and request expect', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
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
                entriesAndRequester,
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

        it('Should fail when app are different', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Request different app adress
            requestOrder.app = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: App mismatch');
        });

        it('Should fail when dataset are different', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Request different dataset adress
            requestOrder.dataset = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Dataset mismatch');
        });

        it('Should fail when requestorder mismatch workerpool restriction ', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Request different dataset adress
            requestOrder.workerpool = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by request order');
        });

        it('Should fail when apporder mismatch dataset restriction ', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Request different dataset adress
            appOrder.datasetrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Dataset restricted by app order');
        });

        it('Should fail when apporder mismatch workerpool restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Set different workerpool address
            appOrder.workerpoolrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by app order');
        });

        it('Should fail when apporder mismatch requester restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Set different requester address
            appOrder.requesterrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Requester restricted by app order');
        });

        it('Should fail when datasetorder mismatch app restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            // Set different app address
            datasetOrder.apprestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: App restricted by dataset order');
        });

        it('Should fail when datasetorder mismatch workerpool restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            datasetOrder.workerpoolrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by dataset order');
        });

        it('Should fail when datasetorder mismatch requester restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            datasetOrder.requesterrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Requester restricted by dataset order');
        });

        it('Should fail when workerpoolorder mismatch app restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            workerpoolOrder.apprestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: App restricted by workerpool order');
        });

        it('Should fail when workerpoolorder mismatch dataset restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            workerpoolOrder.datasetrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Dataset restricted by workerpool order');
        });

        it('Should fail when workerpoolorder mismatch requester restriction', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
                dealTagTee,
            );
            workerpoolOrder.requesterrestrict = '0x0000000000000000000000000000000000000001';

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Requester restricted by workerpool order');
        });

        it('Should fail when app not registered', async function () {
            appRegistry.isRegistered.whenCalledWith(appInstance.address).returns(false);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                entriesAndRequester,
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
            ).to.be.revertedWith('PocoBoost: App not registered');
        });

        it('Should fail when dataset not registered', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetRegistry.isRegistered.whenCalledWith(datasetInstance.address).returns(false);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            await signOrders(domain, orders, accounts);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Dataset not registered');
        });

        it('Should fail when workerpool not registered', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolRegistry.isRegistered
                .whenCalledWith(workerpoolInstance.address)
                .returns(false);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            await signOrders(domain, orders, accounts);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWith('PocoBoost: Workerpool not registered');
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
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            const oracleConsumerInstance = await createMock<TestClient__factory, TestClient>(
                'TestClient',
            );
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
                .withArgs(dealId, taskIndex, results);
            expect(oracleConsumerInstance.receiveResult).to.have.been.calledWith(
                taskId,
                resultsCallback,
            );
        });

        it('Should push result (TEE)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
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

        it('Should push result (Standard)', async function () {
            const tag = constants.NULL.BYTES32;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, tag);
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
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
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        emptyEnclaveAddress,
                        constants.NULL.SIGNATURE,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });

        it('Should not push result with invalid scheduler signature', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            await signOrders(domain, orders, accounts);
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
                        getDealId(domain, requestOrder, taskIndex),
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
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            const schedulerSignature = await buildAndSignSchedulerMessage(
                worker.address,
                getTaskId(dealId, taskIndex),
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
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        anyoneSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid enclave signature');
        });

        it('Should not push result with missing data for callback', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders(entriesAndRequester, dealTagTee);
            requestOrder.callback = '0x000000000000000000000000000000000000ca11';
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
                        getDealId(domain, requestOrder, taskIndex),
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

async function expectOrderConsumed(
    iexecPocoInstance: MockContract<IexecPocoBoostDelegate>,
    orderHash: string,
    expectedConsumedVolume: number | undefined,
) {
    try {
        expect(await iexecPocoInstance.getVariable('m_consumed', [orderHash])).to.equal(
            expectedConsumedVolume,
        );
    } catch (e) {
        if (expectedConsumedVolume == undefined) {
            expect((e as Error).message).to.contain(
                'invalid BigNumber string (argument="value", value="0x"',
            );
            return;
        }
        assert(false); //revert
    }
}
