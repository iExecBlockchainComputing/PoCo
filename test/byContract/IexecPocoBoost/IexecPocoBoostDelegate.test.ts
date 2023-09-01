import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
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
    IexecAccounts,
    OrderMatchAssets,
    OrderMatchPrices,
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

// TODO: Rename to teeDealTag
const dealTagTee = '0x0000000000000000000000000000000000000000000000000000000000000001';
const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const taskIndex = 0;
const volume = taskIndex + 1;
const schedulerRewardRatio = 1;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const EIP712DOMAIN_SEPARATOR = 'EIP712DOMAIN_SEPARATOR';
const BALANCES = 'm_balances';
const FROZENS = 'm_frozens';
const WORKERPOOL_STAKE_RATIO = 30;
const { domain, domainSeparator } = buildDomain();
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;

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
    let orderMatchAssets: OrderMatchAssets;
    let orderMatchPrices: OrderMatchPrices;

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
            beneficiary: beneficiary,
        };
        appInstance = await createMock<App__factory, App>('App');
        workerpoolInstance = await createMock<Workerpool__factory, Workerpool>('Workerpool');
        datasetInstance = await createMock<Dataset__factory, Dataset>('Dataset');
        orderMatchAssets = {
            app: appInstance.address,
            dataset: datasetInstance.address,
            workerpool: workerpoolInstance.address,
        };
        orderMatchPrices = {
            app: appPrice,
            dataset: datasetPrice,
            workerpool: workerpoolPrice,
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
            workerpoolInstance.m_schedulerRewardRatioPolicy.returns(schedulerRewardRatio);

            const appPrice = 1000;
            const datasetPrice = 1_000_000;
            const workerpoolPrice = 1_000_000_000;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    prices: orderMatchPrices,
                    callback: ethers.Wallet.createRandom().address,
                });
            // Should match orders with low app order volume
            // Set volumes
            appOrder.volume = 2; // smallest unconsumed volume among all orders
            datasetOrder.volume = 3;
            workerpoolOrder.volume = 4;
            requestOrder.volume = 5;
            const expectedVolume = 2;
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * expectedVolume;
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerStake,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                },
            });
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance,
            );
            await expectBalance(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterBalance + dealPrice,
            );
            await expectFrozen(iexecPocoBoostInstance, requester.address, initialRequesterFrozen);
            await expectBalance(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerBalance + schedulerStake,
            );
            await expectFrozen(iexecPocoBoostInstance, scheduler.address, initialSchedulerFrozen);
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
            const startTime = await setNextBlockTimestamp();

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
                    dealTagTee,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                )
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(requester.address, iexecPocoBoostInstance.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(requester.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, iexecPocoBoostInstance.address, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake);
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
            expect(deal.workerReward).to.be.equal(
                (workerpoolPrice * // reward depends on
                    (100 - schedulerRewardRatio)) / // worker ratio
                    100,
            );
            expect(deal.deadline).to.be.equal(
                startTime + // match order block timestamp
                    7 * // contribution deadline ratio
                        60, // requested category time reference
            );
            expect(deal.callback)
                .to.be.equal(requestOrder.callback, 'Callback mismatch')
                .to.not.be.equal(constants.NULL.ADDRESS);
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
            expect(deal.shortTag).to.be.equal('0x000000000000000000000001');
            // Check balances.
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerStake,
            );
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + dealPrice,
            );
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerStake,
            );
        });

        it('Should match orders with pre-signatures', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                    dealTagTee,
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

        it('Should match orders without dataset', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);

            const appPrice = 1000;
            const workerpoolPrice = 1_000_000;
            await iexecPocoBoostInstance.setVariable(BALANCES, {
                [requester.address]: 1_001_000,
                [scheduler.address]: computeSchedulerDealStake(workerpoolPrice, volume),
            });

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildCompatibleOrders(
                {
                    assets: {
                        app: appInstance.address,
                        dataset: constants.NULL.ADDRESS, // No dataset.
                        workerpool: workerpoolInstance.address,
                    },
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    prices: {
                        app: appPrice,
                        dataset: 0,
                        workerpool: workerpoolPrice,
                    },
                    tag: dealTagTee,
                },
            );
            await signOrder(domain, appOrder, appProvider);
            await signOrder(domain, workerpoolOrder, scheduler);
            await signOrder(domain, requestOrder, requester);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const emptyDatasetOrderHash = hashOrder(domain, datasetOrder);
            await expectOrderConsumed(iexecPocoBoostInstance, emptyDatasetOrderHash, undefined);

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
                    dealTagTee,
                    requestOrder.params,
                    beneficiary.address,
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
            await expectOrderConsumed(iexecPocoBoostInstance, emptyDatasetOrderHash, undefined);
            const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
            expect(deal.datasetPrice).to.be.equal(0);
        });

        it('Should match orders with low dataset order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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

        it('Should match orders with low request order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                {
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                },
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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

        it('Should fail when requester has insufficient balance', async () => {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const appPrice = 1000;
            const datasetPrice = 1_000_000;
            const workerpoolPrice = 1_000_000_000;
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    prices: orderMatchPrices,
                });

            const initialRequesterBalance = 2;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [requester.address]: initialRequesterBalance, // Way less than dealPrice.
                },
            });
            expect(
                await iexecPocoBoostInstance.getVariable(BALANCES, [requester.address]),
            ).to.be.lessThan(dealPrice);

            await signOrders(domain, orders, accounts);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWithPanic(0x11); // TODO change to explicit message.
        });

        it('Should fail when scheduler has insufficient balance', async () => {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const appPrice = 1000;
            const datasetPrice = 1_000_000;
            const workerpoolPrice = 1_000_000_000;
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    prices: orderMatchPrices,
                });

            const initialRequesterBalance = 2;
            const initialSchedulerBalance = 3; // Way less than what is needed as stake.
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance,
                },
            });
            // Make sure the tx does not fail because of requester's balance.
            expect(
                await iexecPocoBoostInstance.getVariable(BALANCES, [requester.address]),
            ).to.be.greaterThan(dealPrice);
            // Make sure the scheduler does not have enough to stake.
            expect(
                await iexecPocoBoostInstance.getVariable(BALANCES, [scheduler.address]),
            ).to.be.lessThan(schedulerStake);

            await signOrders(domain, orders, accounts);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.revertedWithPanic(0x11); // TODO change to explicit message.
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
            workerpoolInstance.m_schedulerRewardRatioPolicy.returns(schedulerRewardRatio);
            const oracleConsumerInstance = await createMock<TestClient__factory, TestClient>(
                'TestClient',
            );
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const volume = 3;
            const dealPrice = taskPrice * volume;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    prices: orderMatchPrices,
                    volume: volume,
                    callback: oracleConsumerInstance.address,
                });
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialWorkerBalance = 4;
            const initialAppOwnerBalance = 5;
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const schedulerTaskStake = schedulerDealStake / volume;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [worker.address]: initialWorkerBalance,
                    [scheduler.address]: schedulerDealStake,
                    [appProvider.address]: initialAppOwnerBalance,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                },
            });
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
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
            await time.setNextBlockTimestamp(
                startTime +
                    7 * 60 - // deadline
                    1, // push result 1 second before deadline
            );
            // Check pocoboost smart contract balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerDealStake,
            );
            // Check requester balance and frozen
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + dealPrice,
            );
            // Check worker balance
            await expectBalance(iexecPocoBoostInstance, worker.address, initialWorkerBalance);
            // Check scheduler frozen
            await expectFrozen(iexecPocoBoostInstance, scheduler.address, schedulerDealStake);
            // Check app provider balance
            await expectBalance(
                iexecPocoBoostInstance,
                appProvider.address,
                initialAppOwnerBalance,
            );
            const expectedWorkerReward = (
                await iexecPocoBoostInstance.viewDealBoost(dealId)
            ).workerReward.toNumber();
            // Worker reward formula already checked in match orders test, hence
            // we just need to verify here that some worker reward value will be
            // transferred
            expect(expectedWorkerReward).to.be.greaterThan(0);
            const expectedSchedulerReward = workerpoolPrice - expectedWorkerReward;

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
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(requester.address, expectedWorkerReward + appPrice, taskId) //TODO: Seize app + dataset + workerpool price
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, worker.address, expectedWorkerReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(worker.address, expectedWorkerReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, appProvider.address, appPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
            expect(oracleConsumerInstance.receiveResult).to.have.been.calledWith(
                taskId,
                resultsCallback,
            );
            /**
             * Task status verification is delegated to related integration test.
             *
             * Smock does not support getting struct variable from a mapping:
             * https://github.com/defi-wonderland/smock/blame/v2.3.5/docs/source/mocks.rst#L141
             *
             * 1.`IexecAccessors` contract is not deployed within this unit test
             * suite, hence `viewTask` method is not available.
             * 2. Another option would be to duplicate the `viewTask` method in
             * `IexecPocoBoostDelegate` contract but this method is not required
             * in production.
             * 3. It could be also possible to create a new contract for unit test
             * to wrap `IexecPocoBoostDelegate` and attach `viewTask` feature.
             */
            const remainingTasksToPush = volume - 1;
            // Check PoCo boost smart contract balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance +
                    (taskPrice + schedulerTaskStake) * remainingTasksToPush +
                    schedulerTaskStake + // TODO: Remove after unlock scheduler feature
                    expectedSchedulerReward + // TODO: Remove after scheduler reward feature
                    datasetPrice, // TODO: Remove after dataset reward feature
            );
            // Check requester balance and frozen
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen +
                    taskPrice * remainingTasksToPush +
                    expectedSchedulerReward + // TODO: Remove after scheduler reward feature
                    datasetPrice, // TODO: Remove after dataset reward feature
            );
            // Check worker balance
            await expectBalance(
                iexecPocoBoostInstance,
                worker.address,
                initialWorkerBalance + expectedWorkerReward,
            );
            // Check app provider balance
            await expectBalance(
                iexecPocoBoostInstance,
                appProvider.address,
                initialAppOwnerBalance + appPrice,
            );
        });

        it('Should push result (TEE)', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: tag,
                });
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

        it('Should not push result twice', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: standardDealTag,
                });
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
            const pushResultBoost: () => Promise<any> = () =>
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, requestOrder, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        emptyEnclaveAddress,
                        constants.NULL.SIGNATURE,
                    );

            // Push result
            await expect(pushResultBoost()).to.emit(iexecPocoBoostInstance, 'ResultPushedBoost');
            // Push result a second time
            await expect(pushResultBoost()).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not push result after deadline', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
            await signOrders(domain, orders, accounts);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            await time.setNextBlockTimestamp(startTime + 7 * 60); // push result on deadline

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, requestOrder, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Deadline reached');
        });

        it('Should not push result without enclave challenge for TEE task', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Tag requires enclave challenge');
        });

        it('Should not push result with invalid scheduler signature', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                });
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
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    callback: ethers.Wallet.createRandom().address,
                });
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

            await expect(
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

    describe('Claim task Boost', function () {
        beforeEach('mock app, dataset and workerpool', async () => {
            // Mock app, dataset and workerpool here before each test so
            // matchOrdersBoost setup will be lighter when unit testing
            // claimBoost
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
        });

        it('Should claim', async function () {
            const expectedVolume = 2; // > 1 to explicit taskPrice vs dealPrice
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: dealTagTee,
                    prices: orderMatchPrices,
                    volume: expectedVolume,
                });
            await signOrders(domain, orders, accounts);
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerDealStake,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                },
            });
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerDealStake,
            );
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + dealPrice,
            );
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerDealStake,
            );
            await time.setNextBlockTimestamp(startTime + 7 * 60); // claim on deadline

            await expect(iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);
            // Task status verification is delegated to related integration test.
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + taskPrice + schedulerDealStake, // TODO: Remove schedulerStake when kitty reward implemented
            );
            await expectBalance(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterBalance + taskPrice,
            );
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + taskPrice, // 2nd task can still be claimed
            );
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerDealStake, // TODO: Remove schedulerStake when kitty reward implemented
            );
        });

        it('Should not claim if task not unset', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: standardDealTag,
                });
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
                constants.NULL.ADDRESS,
                scheduler,
            );
            await iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    constants.NULL.BYTES32,
                    schedulerSignature,
                    constants.NULL.ADDRESS,
                    constants.NULL.SIGNATURE,
                );

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not claim if task unknown because of wrong deal ID', async function () {
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .claimBoost(
                        '0x00000000000000000000000000000000000000000000000000000000fac6dea1',
                        0,
                    ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not claim if task unknown because of wrong index', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: standardDealTag,
                });
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(
                    dealId, // existing deal
                    1, // only task index 0 would be authorized with this deal volume of 1
                ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not claim before deadline', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } =
                buildCompatibleOrders({
                    assets: orderMatchAssets,
                    requester: requester.address,
                    beneficiary: beneficiary.address,
                    tag: standardDealTag,
                });
            await signOrders(domain, orders, accounts);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
            await time.setNextBlockTimestamp(
                startTime +
                    7 * 60 - // claim
                    1, // just before deadline
            );

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Deadline not reached');
        });
    });
});

/**
 * Mine the next block with a timestamp corresponding to an arbitrary but known
 * date in the future (10 seconds later).
 * It fixes the `Timestamp is lower than the previous block's timestamp` error.
 * e.g: This Error has been seen when running tests with `npm run coverage`.
 * @returns timestamp of the next block.
 */
async function setNextBlockTimestamp() {
    const startTime = (await time.latest()) + 10;
    await time.setNextBlockTimestamp(startTime);
    return startTime;
}

/**
 * Compute the amount of RLC to be staked by the scheduler
 * for a deal. We first compute the percentage by task
 * (See contracts/Store.sol#WORKERPOOL_STAKE_RATIO), then
 * compute the total amount according to the volume.
 * @param workerpoolPrice
 * @param volume number of tasks in the deal
 * @returns amount of total stake
 */
function computeSchedulerDealStake(workerpoolPrice: number, volume: number) {
    return ((workerpoolPrice * WORKERPOOL_STAKE_RATIO) / 100) * volume;
}

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

async function expectBalance(
    iexecPocoInstance: MockContract<IexecPocoBoostDelegate>,
    account: string,
    expectedBalanceValue: number,
) {
    expect(await iexecPocoInstance.getVariable(BALANCES, [account])).to.equal(expectedBalanceValue);
}

async function expectFrozen(
    iexecPocoInstance: MockContract<IexecPocoBoostDelegate>,
    account: string,
    expectedFrozenValue: number,
) {
    expect(await iexecPocoInstance.getVariable(FROZENS, [account])).to.equal(expectedFrozenValue);
}
