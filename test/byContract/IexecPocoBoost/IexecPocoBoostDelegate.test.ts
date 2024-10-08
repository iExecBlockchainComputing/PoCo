// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BytesLike } from '@ethersproject/bytes';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { assert, ethers } from 'hardhat';
import {
    App,
    AppRegistry,
    AppRegistry__factory,
    App__factory,
    Dataset,
    DatasetRegistry,
    DatasetRegistry__factory,
    Dataset__factory,
    GasWasterClient,
    GasWasterClient__factory,
    IERC734,
    IERC734__factory,
    IexecLibOrders_v5__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostCompositeDelegate__factory,
    IexecPocoBoostDelegate,
    TestClient,
    TestClient__factory,
    Workerpool,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../../typechain';
import { IERC1271 } from '../../../typechain/@openzeppelin/contracts-v5/interfaces';
import { IERC1271__factory } from '../../../typechain/factories/@openzeppelin/contracts-v5/interfaces';
import constants from '../../../utils/constants';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildDomain,
    buildOrders,
    createEmptyAppOrder,
    createEmptyDatasetOrder,
    createEmptyRequestOrder,
    createEmptyWorkerpoolOrder,
    hashOrder,
    signOrder,
    signOrders,
} from '../../../utils/createOrders';
import { createMock } from '../../../utils/mock-tools';
import {
    buildAndSignContributionAuthorizationMessage,
    buildAndSignEnclaveMessage,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getDealId,
    getTaskId,
    setNextBlockTimestamp,
} from '../../../utils/poco-tools';

chai.use(smock.matchers);

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
const schedulerRewardRatio = 1;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const EIP712DOMAIN_SEPARATOR = 'EIP712DOMAIN_SEPARATOR';
const BALANCES = 'm_balances';
const FROZENS = 'm_frozens';
const WORKERPOOL_STAKE_RATIO = 30;
const CALLBACK_GAS = 100000;
const kittyAddress = '0x99c2268479b93fDe36232351229815DF80837e23';
const groupMemberPurpose = 4; // See contracts/Store.v8.sol#GROUPMEMBER_PURPOSE
const { domain, domainSeparator } = buildDomain();
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const someSignature = '0xabcd'; // contract signatures could have arbitrary formats
const randomEOAAddress = '0xc0ffee254729296a45a3885639AC7E10F9d54979';

async function deployBoostFixture() {
    const [
        admin,
        requester,
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
        worker2,
        enclave,
        anyone,
        teeBroker,
    ] = await ethers.getSigners();
    const iexecLibOrdersInstanceAddress = await new IexecLibOrders_v5__factory()
        .connect(admin)
        .deploy()
        .then((instance) => instance.deployed())
        .then((instance) => instance.address);
    // Using native smock call here for understandability purposes (also works with
    // the custom `createMock` method)
    const iexecPocoBoostInstance = (await smock
        .mock<IexecPocoBoostCompositeDelegate__factory>('IexecPocoBoostCompositeDelegate', {
            libraries: {
                ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                    iexecLibOrdersInstanceAddress,
            },
        })
        .then((instance) => instance.deploy())
        .then((instance) => instance.deployed())) as MockContract<IexecPocoBoostDelegate>;
    // A global domain separator needs to be set since current contract is being
    // unit tested here (hence no proxy)
    await iexecPocoBoostInstance.setVariable('m_callbackgas', CALLBACK_GAS);
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
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker: worker1,
        worker1,
        worker2,
        enclave,
        anyone,
        teeBroker,
    };
}

describe('IexecPocoBoostDelegate', function () {
    let iexecPocoBoostInstance: MockContract<IexecPocoBoostDelegate>;
    let oracleConsumerInstance: FakeContract<TestClient>;
    let gasWasterClientInstance: MockContract<GasWasterClient>;
    let appInstance: MockContract<App>;
    let workerpoolInstance: MockContract<Workerpool>;
    let datasetInstance: MockContract<Dataset>;
    let appRegistry: FakeContract<AppRegistry>;
    let datasetRegistry: FakeContract<DatasetRegistry>;
    let workerpoolRegistry: FakeContract<WorkerpoolRegistry>;
    let someContractInstance: MockContract<TestClient>;
    let [
        appProvider,
        datasetProvider,
        scheduler,
        worker,
        enclave,
        requester,
        sponsor,
        beneficiary,
        anyone,
        teeBroker,
    ] = [] as SignerWithAddress[];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('set up contract instances and mock app', async () => {
        const fixtures = await loadFixture(deployBoostFixture);
        iexecPocoBoostInstance = fixtures.iexecPocoBoostInstance;
        appProvider = fixtures.appProvider;
        datasetProvider = fixtures.datasetProvider;
        scheduler = fixtures.scheduler;
        worker = fixtures.worker;
        enclave = fixtures.enclave;
        requester = fixtures.requester;
        sponsor = fixtures.sponsor;
        beneficiary = fixtures.beneficiary;
        anyone = fixtures.anyone;
        teeBroker = fixtures.teeBroker;
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        oracleConsumerInstance = await smock.fake<TestClient>(TestClient__factory);
        gasWasterClientInstance = await createMock<GasWasterClient__factory, GasWasterClient>(
            'GasWasterClient',
        ); // Deploy a real but nevertheless observable contract
        appInstance = await createMock<App__factory, App>('App');
        workerpoolInstance = await createMock<Workerpool__factory, Workerpool>('Workerpool');
        datasetInstance = await createMock<Dataset__factory, Dataset>('Dataset');
        someContractInstance = await createMock<TestClient__factory, TestClient>('TestClient'); // any other deployed contract would be fine
        ordersAssets = {
            app: appInstance.address,
            dataset: datasetInstance.address,
            workerpool: workerpoolInstance.address,
        };
        ordersPrices = {
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

    describe('Match orders Boost', function () {
        it('Should match orders (TEE)', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.m_schedulerRewardRatioPolicy.returns(schedulerRewardRatio);

            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: ethers.Wallet.createRandom().address,
            });
            const {
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requesterOrder: requestOrder,
            } = orders.toObject();
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
            await signOrders(domain, orders, ordersActors);
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

            expect(
                await iexecPocoBoostInstance.callStatic.matchOrdersBoost(...orders.toArray()),
            ).to.equal(dealId);
            await expect(iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()))
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolInstance.address,
                    dealId,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
                    teeDealTag,
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
            const deal = await viewDealBoost(dealId);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester, 'Requester mismatch');
            expect(deal.appOwner).to.be.equal(appProvider.address, 'App owner mismatch');
            expect(deal.datasetOwner).to.be.equal(
                datasetProvider.address,
                'Dataset owner mismatch',
            );
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
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.sponsor).to.be.equal(requestOrder.requester, 'Sponsor mismatch');

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

        it('Should sponsor match orders (TEE)', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.m_schedulerRewardRatioPolicy.returns(schedulerRewardRatio);

            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: ethers.Wallet.createRandom().address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
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
            const initialSponsorBalance = 6;
            const initialSponsorFrozen = 7;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance,
                    [sponsor.address]: initialSponsorBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerStake,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [sponsor.address]: initialSponsorFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                },
            });
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance,
            );
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(iexecPocoBoostInstance, requester.address, initialRequesterFrozen);
            await expectBalance(
                iexecPocoBoostInstance,
                sponsor.address,
                initialSponsorBalance + dealPrice,
            );
            await expectFrozen(iexecPocoBoostInstance, sponsor.address, initialSponsorFrozen);
            await expectBalance(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerBalance + schedulerStake,
            );
            await expectFrozen(iexecPocoBoostInstance, scheduler.address, initialSchedulerFrozen);
            await signOrders(domain, orders, ordersActors);
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

            expect(
                await iexecPocoBoostInstance
                    .connect(sponsor)
                    .callStatic.sponsorMatchOrdersBoost(...orders.toArray()),
            ).to.equal(dealId);
            expect(
                await iexecPocoBoostInstance.callStatic.computeDealVolume(...orders.toArray()),
            ).to.equal(expectedVolume);
            await expect(
                iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost(...orders.toArray()),
            )
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolInstance.address,
                    dealId,
                    appInstance.address,
                    datasetInstance.address,
                    requestOrder.category,
                    teeDealTag,
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
                .withArgs(sponsor.address, iexecPocoBoostInstance.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(sponsor.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, iexecPocoBoostInstance.address, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'DealSponsoredBoost')
                .withArgs(dealId, sponsor.address);
            await expectOrderConsumed(iexecPocoBoostInstance, appOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, datasetOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester);
            expect(deal.appOwner).to.be.equal(appProvider.address);
            expect(deal.datasetOwner).to.be.equal(datasetProvider.address);
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address);
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
                .to.be.equal(requestOrder.callback)
                .to.not.be.equal(constants.NULL.ADDRESS);
            // Check prices.
            expect(deal.workerpoolPrice).to.be.equal(workerpoolOrder.workerpoolprice);
            expect(deal.appPrice).to.be.equal(appOrder.appprice);
            expect(deal.datasetPrice).to.be.equal(datasetOrder.datasetprice);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.sponsor).to.be.equal(sponsor.address);

            // Check balances.
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerStake,
            );
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(iexecPocoBoostInstance, requester.address, initialRequesterFrozen);
            await expectBalance(iexecPocoBoostInstance, sponsor.address, initialSponsorBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                sponsor.address,
                initialSponsorFrozen + dealPrice,
            );
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerStake,
            );
        });

        it('Should match orders with trust equals 1', async function () {
            // Mock owner() method of assets contracts.
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            // Build orders
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Change trust.
            requestOrder.trust = 1;
            // Sign & hash orders.
            await signOrders(domain, orders, ordersActors);
            // Run & verify.
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
        });

        it('Should match orders when assets and requester belongs to identity groups', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            let appOrder = createEmptyAppOrder();
            let datasetOrder = createEmptyDatasetOrder();
            let workerpoolOrder = createEmptyWorkerpoolOrder();
            let requestOrder = createEmptyRequestOrder();
            // App
            const appGroupIdentityInstance = await createFakeErc734IdentityInstance();
            appOrder.app = appInstance.address;
            datasetOrder.apprestrict = appGroupIdentityInstance.address;
            workerpoolOrder.apprestrict = appGroupIdentityInstance.address;
            const expectedCallsToAppGroup = 2;
            requestOrder.app = appOrder.app;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                appGroupIdentityInstance,
                appOrder.app,
            );
            // Dataset
            const datasetGroupIdentityInstance = await createFakeErc734IdentityInstance();
            datasetOrder.dataset = datasetInstance.address;
            appOrder.datasetrestrict = datasetGroupIdentityInstance.address;
            workerpoolOrder.datasetrestrict = datasetGroupIdentityInstance.address;
            const expectedCallsToDatasetGroup = 2;
            requestOrder.dataset = datasetOrder.dataset;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                datasetGroupIdentityInstance,
                datasetOrder.dataset,
            );
            // Workerpool
            const workerpoolGroupIdentityInstance = await createFakeErc734IdentityInstance();
            workerpoolOrder.workerpool = workerpoolInstance.address;
            appOrder.workerpoolrestrict = workerpoolGroupIdentityInstance.address;
            datasetOrder.workerpoolrestrict = workerpoolGroupIdentityInstance.address;
            requestOrder.workerpool = workerpoolGroupIdentityInstance.address;
            const expectedCallsToWorkerpoolGroup = 3;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                workerpoolGroupIdentityInstance,
                workerpoolOrder.workerpool,
            );
            // Requester
            const requesterGroupIdentityInstance = await createFakeErc734IdentityInstance();
            requestOrder.requester = requester.address;
            appOrder.requesterrestrict = requesterGroupIdentityInstance.address;
            datasetOrder.requesterrestrict = requesterGroupIdentityInstance.address;
            workerpoolOrder.requesterrestrict = requesterGroupIdentityInstance.address;
            const expectedCallsToRequesterGroup = 3;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                requesterGroupIdentityInstance,
                requester.address,
            );
            // Finish orders setup
            appOrder.volume = volume;
            datasetOrder.volume = volume;
            workerpoolOrder.volume = volume;
            requestOrder.volume = volume;
            await signOrders(
                domain,
                new IexecOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
                ordersActors,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
            expectIdentityContractCalledForCandidateInGroup(
                appGroupIdentityInstance,
                appOrder.app,
                expectedCallsToAppGroup,
            );
            expectIdentityContractCalledForCandidateInGroup(
                datasetGroupIdentityInstance,
                datasetOrder.dataset,
                expectedCallsToDatasetGroup,
            );
            expectIdentityContractCalledForCandidateInGroup(
                workerpoolGroupIdentityInstance,
                workerpoolOrder.workerpool,
                expectedCallsToWorkerpoolGroup,
            );
            expectIdentityContractCalledForCandidateInGroup(
                requesterGroupIdentityInstance,
                requestOrder.requester,
                expectedCallsToRequesterGroup,
            );
        });

        it('Should match orders if signers are smart contracts', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toObject();
            const erc1271Instance = await createFakeERC1271();
            erc1271Instance.isValidSignature.returns('0x1626ba7e');
            appInstance.owner.returns(erc1271Instance.address);
            datasetInstance.owner.returns(erc1271Instance.address);
            workerpoolInstance.owner.returns(erc1271Instance.address);
            requestOrder.requester = erc1271Instance.address;
            appOrder.sign = someSignature;
            datasetOrder.sign = someSignature;
            workerpoolOrder.sign = someSignature;
            requestOrder.sign = someSignature;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
            expect(erc1271Instance.isValidSignature)
                .to.have.been.calledWith(hashOrder(domain, appOrder), someSignature)
                .to.have.been.calledWith(hashOrder(domain, datasetOrder), someSignature)
                .to.have.been.calledWith(hashOrder(domain, workerpoolOrder), someSignature)
                .to.have.been.calledWith(hashOrder(domain, requestOrder), someSignature)
                .callCount(4);
        });

        it('Should match orders with pre-signatures (TEE)', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
            }).toObject();
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

        it('Should match orders without dataset (TEE)', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const dealPrice = (appPrice + workerpoolPrice) * volume;
            await iexecPocoBoostInstance.setVariable(BALANCES, {
                [requester.address]: dealPrice,
                [scheduler.address]: computeSchedulerDealStake(workerpoolPrice, volume),
            });

            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
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
                tag: teeDealTag,
            }).toObject();
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
                    teeDealTag,
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
            const deal = await viewDealBoost(dealId);
            expect(deal.datasetPrice).to.be.equal(0);
        });

        it('Should match orders with low workerpool order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 5;
            datasetOrder.volume = 4;
            workerpoolOrder.volume = 3; // smallest unconsumed volume among all orders
            requestOrder.volume = 6;
            const expectedVolume = 3;
            await signOrders(domain, orders, ordersActors);
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
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders with low request order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 7;
            datasetOrder.volume = 6;
            workerpoolOrder.volume = 5;
            requestOrder.volume = 4; // smallest unconsumed volume among all orders
            const expectedVolume = 4;
            await signOrders(domain, orders, ordersActors);
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
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders with low dataset order volume', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 6;
            datasetOrder.volume = 5; // smallest unconsumed volume among all orders
            workerpoolOrder.volume = 7;
            requestOrder.volume = 8;
            const expectedVolume = 5;
            await signOrders(domain, orders, ordersActors);
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
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match request order multiple times until fully consumed', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            appOrder.volume = 8;
            datasetOrder.volume = 8;
            requestOrder.volume = 8;
            // Partially consume orders in a first batch
            workerpoolOrder.volume = 3; // 3 now and 5 later
            await signOrders(domain, orders, ordersActors);
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
            const deal = await viewDealBoost(dealId1);
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
            const deal2 = await viewDealBoost(dealId2);
            expect(deal2.botFirst).to.be.equal(3); // next index after last task of deal1:{0, 1, 2}
            expect(deal2.botSize).to.be.equal(5);
            // Verify request is fully consumed
            await expectOrderConsumed(iexecPocoBoostInstance, requestOrderHash, 8);
        });

        it('Should fail when trust is greater than 1', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set bad trust (> 1).
            orders.requester.trust = 2;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Bad trust level');
        });

        it('Should fail when categories are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set different categories
            orders.requester.category = 1;
            orders.workerpool.category = 2;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Category mismatch');
        });

        it('Should fail when category unknown', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Unknown category
            orders.requester.category = 1;
            orders.workerpool.category = 1;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Unknown category');
        });

        it('Should fail when app max price is less than app price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            orders.app.appprice = 200;
            orders.requester.appmaxprice = 100;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced app');
        });

        it('Should fail when dataset max price is less than dataset price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set dataset price higher than dataset max price
            orders.dataset.datasetprice = 300;
            orders.requester.datasetmaxprice = 200;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced dataset');
        });

        it('Should fail when workerpool max price is less than workerpool price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set workerpool price higher than workerpool max price
            orders.workerpool.workerpoolprice = 400;
            orders.requester.workerpoolmaxprice = 300;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced workerpool');
        });

        it('Should fail when workerpool tag does not satisfy app, dataset and request requirements', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            // Manually set the tags for app, dataset, and request orders
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000001'; // 0b0001
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Set the workerpool tag to a different value
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000004'; // 0b0100
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool tag does not match demand');
        });

        it('Should fail when the last bit of app tag does not satisfy dataset or request requirements', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            // Manually set the tags for app, dataset, and request orders
            // The last bit of dataset and request tag is 1, but app tag does not set it
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Set the workerpool tag to pass first tag check
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App tag does not match demand');
        });

        it('Should fail when app are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Request another app address
            orders.requester.app = '0x0000000000000000000000000000000000000001';
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App mismatch');
        });

        it('Should fail when dataset are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Request another dataset address
            orders.requester.dataset = '0x0000000000000000000000000000000000000001';
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Dataset mismatch');
        });

        it('Should fail when request order workerpool mismatches workerpool order workerpool (EOA, SC)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // EOA
            orders.requester.workerpool = randomEOAAddress;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by request order');
            // SC
            orders.requester.workerpool = someContractInstance.address;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by request order');
        });

        /**
         * Dynamically generated tests for all different restrictions in orders
         * (requesterrestrict, apprestrict, workerpoolrestrict, datasetrestrict).
         */
        ['app', 'workerpool', 'dataset'].forEach((orderName) => {
            // No request order
            ['requester', 'app', 'workerpool', 'dataset'].forEach((assetName) => {
                // Filter irrelevant cases. E.g. no need to change the app address in the app order.
                if (orderName.includes(assetName)) {
                    return;
                }
                it(`Should fail when ${orderName} order mismatch ${assetName} restriction (EOA, SC)`, async function () {
                    const capitalizedAssetName =
                        assetName.charAt(0).toUpperCase() + assetName.substring(1); // app => App
                    const revertMessage = `PocoBoost: ${capitalizedAssetName} restricted by ${orderName} order`;
                    const orders = buildOrders({
                        assets: ordersAssets,
                        requester: requester.address,
                    });
                    // EOA
                    // E.g. changes orders['app']['apprestrict'] = 0xAddress
                    // @ts-ignore
                    orders[orderName][assetName + 'restrict'] = randomEOAAddress;
                    await expect(
                        iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
                    ).to.be.revertedWith(revertMessage);
                    // SC
                    // @ts-ignore
                    orders[orderName][assetName + 'restrict'] = someContractInstance.address;
                    await expect(
                        iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
                    ).to.be.revertedWith(revertMessage);
                });
            });
        });

        it('Should fail when app not registered', async function () {
            appRegistry.isRegistered.whenCalledWith(appInstance.address).returns(false);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App not registered');
        });

        it('Should fail when invalid app order signature from EOA', async function () {
            appInstance.owner.returns(appProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid app order signature');
        });

        it('Should fail when invalid app order signature from contract', async function () {
            const erc1271Instance = await createFakeERC1271();
            appInstance.owner.returns(erc1271Instance.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            orders.app.sign = someSignature;
            const appOrderHash = hashOrder(domain, orders.app);
            whenERC1271CalledThenReplyInvalidSignature(
                erc1271Instance,
                appOrderHash,
                someSignature,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid app order signature');
            await expectERC1271CalledOnceWith(erc1271Instance, appOrderHash, someSignature);
        });

        it('Should fail when dataset not registered', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetRegistry.isRegistered.whenCalledWith(datasetInstance.address).returns(false);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Dataset not registered');
        });

        it('Should fail when invalid dataset order signature from EOA', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid dataset order signature');
        });

        it('Should fail when invalid dataset order signature from contract', async function () {
            const erc1271Instance = await createFakeERC1271();
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(erc1271Instance.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            orders.dataset.sign = someSignature;
            const datasetOrderHash = hashOrder(domain, orders.dataset);
            whenERC1271CalledThenReplyInvalidSignature(
                erc1271Instance,
                datasetOrderHash,
                someSignature,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid dataset order signature');
            await expectERC1271CalledOnceWith(erc1271Instance, datasetOrderHash, someSignature);
        });

        it('Should fail when workerpool not registered', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolRegistry.isRegistered
                .whenCalledWith(workerpoolInstance.address)
                .returns(false);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool not registered');
        });

        it('Should fail when invalid workerpool order signature from EOA', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid workerpool order signature');
        });

        it('Should fail when invalid workerpool order signature from contract', async function () {
            const erc1271Instance = await createFakeERC1271();
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(erc1271Instance.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            orders.workerpool.sign = someSignature;
            const workerpoolOrderHash = hashOrder(domain, orders.workerpool);
            whenERC1271CalledThenReplyInvalidSignature(
                erc1271Instance,
                workerpoolOrderHash,
                someSignature,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid workerpool order signature');
            await expectERC1271CalledOnceWith(erc1271Instance, workerpoolOrderHash, someSignature);
        });

        it('Should fail when invalid request order signature from EOA', async function () {
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, scheduler);
            await signOrder(domain, orders.requester, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid request order signature');
        });

        it('Should fail when invalid request order signature from contract', async function () {
            const erc1271Instance = await createFakeERC1271();
            appInstance.owner.returns(appProvider.address);
            datasetInstance.owner.returns(datasetProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: erc1271Instance.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, scheduler);
            orders.requester.sign = someSignature;
            const requestOrderHash = hashOrder(domain, orders.requester);
            whenERC1271CalledThenReplyInvalidSignature(
                erc1271Instance,
                requestOrderHash,
                someSignature,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid request order signature');
            await expectERC1271CalledOnceWith(erc1271Instance, requestOrderHash, someSignature);
        });

        it('Should fail if one or more orders are consumed', async function () {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set volumes
            orders.app.volume = 0; // nothing to consume
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: One or more orders consumed');
        });

        it('Should fail when requester has insufficient balance', async () => {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
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

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });

        it('Should fail when scheduler has insufficient balance', async () => {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
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

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
        it('Should fail when sponsor has insufficient balance', async () => {
            appInstance.owner.returns(appProvider.address);
            workerpoolInstance.owner.returns(scheduler.address);
            datasetInstance.owner.returns(datasetProvider.address);

            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });

            const initialSponsorBalance = 2;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [sponsor.address]: initialSponsorBalance, // Way less than dealPrice.
                },
            });
            expect(
                await iexecPocoBoostInstance.getVariable(BALANCES, [sponsor.address]),
            ).to.be.lessThan(dealPrice);

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
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
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const volume = 3;
            const dealPrice = taskPrice * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: volume,
                callback: oracleConsumerInstance.address,
            });
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialWorkerBalance = 4;
            const initialAppOwnerBalance = 5;
            const initialDatasetOwnerBalance = 6;
            const initialSchedulerBalance = 7;
            const initialKitty = 10_000_000_010; // MIN_KITTY * 10 + 10,
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const schedulerTaskStake = schedulerDealStake / volume;
            // Setup: MIN_REWARD < reward < available
            // Further assertion on scheduler kitty reward will fail if the
            // KITTY_RATIO constant is someday updated in the source code.
            const expectedSchedulerKittyRewardForTask1 =
                (initialKitty * // total kitty
                    10) / // KITTY_RATIO
                100; // percentage

            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance + initialKitty,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [worker.address]: initialWorkerBalance,
                    [scheduler.address]: initialSchedulerBalance + schedulerDealStake,
                    [appProvider.address]: initialAppOwnerBalance,
                    [datasetProvider.address]: initialDatasetOwnerBalance,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [kittyAddress]: initialKitty,
                },
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
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
            await time.setNextBlockTimestamp(
                startTime +
                    7 * 60 - // deadline
                    1, // push result 1 second before deadline
            );
            // Check pocoboost smart contract balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerDealStake + initialKitty,
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
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(iexecPocoBoostInstance, scheduler.address, schedulerDealStake);
            // Check kitty frozen
            await expectFrozen(iexecPocoBoostInstance, kittyAddress, initialKitty);
            // Check app provider balance
            await expectBalance(
                iexecPocoBoostInstance,
                appProvider.address,
                initialAppOwnerBalance,
            );
            // Check dataset provider balance
            await expectBalance(
                iexecPocoBoostInstance,
                datasetProvider.address,
                initialDatasetOwnerBalance,
            );
            const expectedWorkerReward = (await viewDealBoost(dealId)).workerReward.toNumber();
            // Worker reward formula already checked in match orders test, hence
            // we just need to verify here that some worker reward value will be
            // transferred
            expect(expectedWorkerReward).to.be.greaterThan(0);
            const expectedSchedulerBaseReward = workerpoolPrice - expectedWorkerReward;
            const expectedSchedulerFullReward =
                expectedSchedulerBaseReward + expectedSchedulerKittyRewardForTask1;

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
                .withArgs(requester.address, taskPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, worker.address, expectedWorkerReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(worker.address, expectedWorkerReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, appProvider.address, appPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, datasetProvider.address, datasetPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(kittyAddress, expectedSchedulerKittyRewardForTask1, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(
                    iexecPocoBoostInstance.address,
                    scheduler.address,
                    expectedSchedulerFullReward,
                )
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(scheduler.address, expectedSchedulerFullReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
            expect(oracleConsumerInstance.receiveResult).to.have.been.calledOnceWith(
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
                    initialKitty -
                    expectedSchedulerKittyRewardForTask1,
            );
            // Check requester balance and frozen
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + taskPrice * remainingTasksToPush,
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
            // Check dataset provider balance
            await expectBalance(
                iexecPocoBoostInstance,
                datasetProvider.address,
                initialDatasetOwnerBalance + datasetPrice,
            );
            // Check scheduler balance and frozen
            await expectBalance(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerBalance + schedulerTaskStake + expectedSchedulerFullReward,
            );
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                schedulerTaskStake * remainingTasksToPush,
            );
            // Check kitty frozen
            await expectFrozen(
                iexecPocoBoostInstance,
                kittyAddress,
                initialKitty - expectedSchedulerKittyRewardForTask1,
            );
        });

        it('Should push result (TEE with contribution authorization signed by scheduler)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
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

        it('Should push result (TEE with contribution authorization signed by broker)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            const teeBrokerAddr = teeBroker.address;
            await iexecPocoBoostInstance.setVariable('m_teebroker', teeBrokerAddr);

            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
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
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });

        it('Should push result', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const emptyEnclaveAddress = constants.NULL.ADDRESS;
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
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

        it('Should push result even if callback target is not a contract', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: ethers.Wallet.createRandom().address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const resultsCallback = '0xab';

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        await buildAndSignContributionAuthorizationMessage(
                            worker.address,
                            taskId,
                            enclave.address,
                            scheduler,
                        ),
                        enclave.address,
                        await buildAndSignEnclaveMessage(
                            worker.address,
                            taskId,
                            ethers.utils.keccak256(resultsCallback),
                            enclave,
                        ),
                    ),
            ).to.emit(iexecPocoBoostInstance, 'ResultPushedBoost');
        });

        it('Should push result even if callback reverts', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: oracleConsumerInstance.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const resultsCallback = '0xab';
            oracleConsumerInstance.receiveResult.reverts();

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        await buildAndSignContributionAuthorizationMessage(
                            worker.address,
                            taskId,
                            enclave.address,
                            scheduler,
                        ),
                        enclave.address,
                        await buildAndSignEnclaveMessage(
                            worker.address,
                            taskId,
                            ethers.utils.keccak256(resultsCallback),
                            enclave,
                        ),
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                /**
                 * Oracle consumer has been called but did not succeed.
                 */
                .to.not.emit(oracleConsumerInstance, 'GotResult');
            expect(oracleConsumerInstance.receiveResult).to.have.been.calledOnceWith(
                taskId,
                resultsCallback,
            );
        });

        it('Should push result even if callback consumes maximum gas', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                callback: gasWasterClientInstance.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const { resultsCallback } = buildResultCallbackAndDigest(123);
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                constants.NULL.ADDRESS,
                scheduler,
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
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                /**
                 * Gas waster client has been called but run out-of-gas.
                 */
                .to.not.emit(gasWasterClientInstance, 'GotResult');
            expect(gasWasterClientInstance.receiveResult).to.have.been.calledOnceWith(
                taskId,
                resultsCallback,
            );
        });

        it('Should not push result if wrong deal ID', async function () {
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        '0x00000000000000000000000000000000000000000000000000000000fac6dea1',
                        taskIndex,
                        '0x',
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not push result if out-of-range task index', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

            await expect(
                iexecPocoBoostInstance.connect(worker).pushResultBoost(
                    dealId, // existing deal
                    1, // only task index 0 would be authorized with this deal volume of 1
                    '0x',
                    constants.NULL.BYTES32,
                    constants.NULL.SIGNATURE,
                    constants.NULL.ADDRESS,
                    constants.NULL.SIGNATURE,
                ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not push result twice', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const emptyEnclaveAddress = constants.NULL.ADDRESS;
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                emptyEnclaveAddress,
                scheduler,
            );
            const pushResultBoost: () => Promise<any> = () =>
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
                    );

            // Push result
            await expect(pushResultBoost()).to.emit(iexecPocoBoostInstance, 'ResultPushedBoost');
            // Push result a second time
            await expect(pushResultBoost()).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not push result after deadline', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + 7 * 60); // push result on deadline

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
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
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

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
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const anyoneSignature = anyone.signMessage(constants.NULL.BYTES32);

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        anyoneSignature,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid contribution authorization signature');
        });

        it('Should not push result with invalid broker signature', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await iexecPocoBoostInstance.setVariable('m_teebroker', teeBroker.address);

            await signOrders(domain, orders, ordersActors);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const anyoneSignature = anyone.signMessage(constants.NULL.BYTES32);

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        anyoneSignature,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid contribution authorization signature');
        });

        it('Should not push result with invalid enclave signature', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });

            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
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
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: ethers.Wallet.createRandom().address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
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
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Callback requires data');
        });

        it('Should not push result without enough gas for callback', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                callback: gasWasterClientInstance.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const { resultsCallback } = buildResultCallbackAndDigest(123);
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                constants.NULL.ADDRESS,
                scheduler,
            );
            const pushResultArgs = [
                dealId,
                taskIndex,
                results,
                resultsCallback,
                schedulerSignature,
                constants.NULL.ADDRESS,
                constants.NULL.SIGNATURE,
            ] as [BytesLike, BigNumberish, BytesLike, BytesLike, BytesLike, string, BytesLike];
            const successfulTxGasLimit = await iexecPocoBoostInstance
                .connect(worker)
                .estimateGas.pushResultBoost(...pushResultArgs);
            const failingTxGaslimit = successfulTxGasLimit.sub(
                BigNumber.from(CALLBACK_GAS).div(63),
            ); // Forward to consumer contract less gas than it has the right to consume

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(...pushResultArgs, { gasLimit: failingTxGaslimit }),
            ).to.be.revertedWith('PocoBoost: Not enough gas after callback');
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
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const claimedTasks = 1;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const initialKitty = 6;
            const initialFrozenKitty = 6;
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerDealStake,
                    [kittyAddress]: initialKitty,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                    [kittyAddress]: initialFrozenKitty,
                },
            });
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            // Check poco boost balance
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
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerDealStake,
            );

            // Check kitty balance and frozen
            await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
            await expectFrozen(iexecPocoBoostInstance, kittyAddress, initialFrozenKitty);
            await time.setNextBlockTimestamp(startTime + 7 * 60); // claim on deadline

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

            const remainingTasksToClaim = expectedVolume - claimedTasks;
            // Task status verification is delegated to related integration test.
            // Check poco boost balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance +
                    taskPrice * remainingTasksToClaim + // requester has 2nd & 3rd task locked
                    schedulerDealStake, // kitty value since 1st task seized
            );
            // Check requester balance and frozen
            await expectBalance(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterBalance + taskPrice * claimedTasks,
            );
            await expectFrozen(
                iexecPocoBoostInstance,
                requester.address,
                initialRequesterFrozen + taskPrice * remainingTasksToClaim, // 2nd & 3rd tasks can still be claimed
            );
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerTaskStake * remainingTasksToClaim,
            );
            // Check kitty reward balance and frozen
            await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
            await expectFrozen(
                iexecPocoBoostInstance,
                kittyAddress,
                initialFrozenKitty + schedulerTaskStake * claimedTasks,
            );
        });

        it('Should claim two tasks', async function () {
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const tasksToClaim = 2;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const initialKitty = 6;
            const initialFrozenKitty = 6;
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerDealStake,
                    [kittyAddress]: initialKitty,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                    [kittyAddress]: initialFrozenKitty,
                },
            });
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            // Check poco boost balance
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
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerDealStake,
            );
            // Check kitty balance and frozen
            await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
            await expectFrozen(iexecPocoBoostInstance, kittyAddress, initialFrozenKitty);
            await time.setNextBlockTimestamp(startTime + 7 * 60); // claim on deadline
            for (let index = 0; index < tasksToClaim; index++) {
                await iexecPocoBoostInstance.connect(worker).claimBoost(dealId, index);
                const claimedTasks = index + 1;
                const remainingTasksToClaim = expectedVolume - claimedTasks;
                // Verifications after claiming "claimedTasks" tasks.
                // Check poco boost balance
                await expectBalance(
                    iexecPocoBoostInstance,
                    iexecPocoBoostInstance.address,
                    initialIexecPocoBalance +
                        taskPrice * remainingTasksToClaim + // requester has still remainingTasksToClaim task locked
                        schedulerDealStake, // stake of remaining tasks to claim + seized stake of claimed tasks moved to kitty
                );
                // Check requester balance and frozen.
                await expectBalance(
                    iexecPocoBoostInstance,
                    requester.address,
                    initialRequesterBalance + taskPrice * claimedTasks,
                );
                await expectFrozen(
                    iexecPocoBoostInstance,
                    requester.address,
                    initialRequesterFrozen + taskPrice * remainingTasksToClaim,
                );
                // Check scheduler balance and frozen
                await expectBalance(
                    iexecPocoBoostInstance,
                    scheduler.address,
                    initialSchedulerBalance,
                );
                await expectFrozen(
                    iexecPocoBoostInstance,
                    scheduler.address,
                    initialSchedulerFrozen + schedulerTaskStake * remainingTasksToClaim,
                );
                // Check kitty reward balance and frozen
                await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
                await expectFrozen(
                    iexecPocoBoostInstance,
                    kittyAddress,
                    initialFrozenKitty + schedulerTaskStake * claimedTasks,
                );
            }
        });

        it('Should claim by anyone when match orders is sponsored', async function () {
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const claimedTasks = 1;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const initialKitty = 6;
            const initialFrozenKitty = 6;
            const initialSponsorBalance = 7;
            const initialSponsorFrozen = 8;
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecPocoBoostInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoBoostInstance.address]: initialIexecPocoBalance,
                    [requester.address]: initialRequesterBalance,
                    [sponsor.address]: initialSponsorBalance + dealPrice,
                    [scheduler.address]: initialSchedulerBalance + schedulerDealStake,
                    [kittyAddress]: initialKitty,
                },
                [FROZENS]: {
                    [requester.address]: initialRequesterFrozen,
                    [sponsor.address]: initialSponsorFrozen,
                    [scheduler.address]: initialSchedulerFrozen,
                    [kittyAddress]: initialFrozenKitty,
                },
            });
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .connect(sponsor)
                .sponsorMatchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            // Check poco boost balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerDealStake,
            );
            // Check requester balance and frozen
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(iexecPocoBoostInstance, requester.address, initialRequesterFrozen);
            // Check sponsor balance and frozen
            await expectBalance(iexecPocoBoostInstance, sponsor.address, initialSponsorBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                sponsor.address,
                initialSponsorFrozen + dealPrice,
            );
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerDealStake,
            );

            // Check kitty balance and frozen
            await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
            await expectFrozen(iexecPocoBoostInstance, kittyAddress, initialFrozenKitty);
            await time.setNextBlockTimestamp(startTime + 7 * 60); // claim on deadline

            await expect(iexecPocoBoostInstance.connect(anyone).claimBoost(dealId, taskIndex))
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(iexecPocoBoostInstance.address, sponsor.address, taskPrice)
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

            const remainingTasksToClaim = expectedVolume - claimedTasks;
            // Task status verification is delegated to related integration test.
            // Check poco boost balance
            await expectBalance(
                iexecPocoBoostInstance,
                iexecPocoBoostInstance.address,
                initialIexecPocoBalance +
                    taskPrice * remainingTasksToClaim + // requester has 2nd & 3rd task locked
                    schedulerDealStake, // kitty value since 1st task seized
            );
            // Check requester balance and frozen
            await expectBalance(iexecPocoBoostInstance, requester.address, initialRequesterBalance);
            await expectFrozen(iexecPocoBoostInstance, requester.address, initialRequesterFrozen);
            // Check sponsor balance and frozen
            await expectBalance(
                iexecPocoBoostInstance,
                sponsor.address,
                initialSponsorBalance + taskPrice * claimedTasks,
            );
            await expectFrozen(
                iexecPocoBoostInstance,
                sponsor.address,
                initialSponsorFrozen + taskPrice * remainingTasksToClaim, // 2nd & 3rd tasks can still be claimed
            );
            // Check scheduler balance and frozen
            await expectBalance(iexecPocoBoostInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoBoostInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerTaskStake * remainingTasksToClaim,
            );
            // Check kitty reward balance and frozen
            await expectBalance(iexecPocoBoostInstance, kittyAddress, initialKitty);
            await expectFrozen(
                iexecPocoBoostInstance,
                kittyAddress,
                initialFrozenKitty + schedulerTaskStake * claimedTasks,
            );
        });

        it('Should not claim if wrong deal ID', async function () {
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .claimBoost(
                        '0x00000000000000000000000000000000000000000000000000000000fac6dea1',
                        0,
                    ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not claim if out-of-range task index', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(
                    dealId, // existing deal
                    1, // only task index 0 would be authorized with this deal volume of 1
                ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        // Different test than other `Should not claim if task not unset` test
        it('Should not claim twice', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + 7 * 60);
            // Claim
            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.emit(iexecPocoBoostInstance, 'TaskClaimed');
            // Claim a second time
            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not claim if task not unset', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
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

        it('Should not claim before deadline', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
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

    /**
     * @notice Smock does not support getting struct variable from a mapping.
     */
    async function viewDealBoost(dealId: string) {
        return await IexecPocoBoostAccessorsDelegate__factory.connect(
            iexecPocoBoostInstance.address,
            anyone,
        ).viewDealBoost(dealId);
    }
});

/**
 * Create a fake ERC734 identity contract instance.
 * @returns A fake ERC734 identity contract instance.
 */
async function createFakeErc734IdentityInstance() {
    return await smock.fake<IERC734>(IERC734__factory);
}

/**
 * If the ERC734 identity contract is asked if a given candidate is in a group, then
 * return true.
 * @param erc734IdentityContractInstance A fake ERC734 identity contract instance.
 * @param candidate The candidate that should belong to the group.
 */
function whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
    erc734IdentityContractInstance: FakeContract<IERC734>,
    candidate: string,
) {
    erc734IdentityContractInstance.keyHasPurpose
        .whenCalledWith(addressToBytes32(candidate), groupMemberPurpose)
        .returns(true);
}

/**
 * Expect that an ERC734 identity contract has been called a specific number of times
 * for a given candidate in a group.
 * @param erc734IdentityContractInstance A fake ERC734 identity contract instance.
 * @param candidate The candidate that should belong to the group.
 * @param expectedCalledCount The expected number of calls.
 */
function expectIdentityContractCalledForCandidateInGroup(
    erc734IdentityContractInstance: FakeContract<IERC734>,
    candidate: string,
    expectedCalledCount: number,
) {
    expect(erc734IdentityContractInstance.keyHasPurpose)
        .to.have.been.calledWith(addressToBytes32(candidate), groupMemberPurpose)
        .callCount(expectedCalledCount);
}

/**
 * Convert an address to a bytes32 prefixed with zeros.
 * @param address The address to convert to bytes32.
 * @returns The address in bytes32 format.
 */
function addressToBytes32(address: string): string {
    return ethers.utils.hexZeroPad(address, 32).toLowerCase();
}

/**
 * Create a fake ERC1271 contract.
 * @returns A fake ERC1271 contract instance.
 */
async function createFakeERC1271() {
    return await smock.fake<IERC1271>(IERC1271__factory);
}

/**
 * Expect that an ERC1271 contract has been called once and replied that the
 * signature was invalid.
 * @param erc1271Instance A fake ERC1271 contract instance.
 * @param orderHash The hash of the order.
 * @param signature The signature to be considered as invalid.
 */
function whenERC1271CalledThenReplyInvalidSignature(
    erc1271Instance: FakeContract<IERC1271>,
    orderHash: string,
    signature: string,
) {
    erc1271Instance.isValidSignature.whenCalledWith(orderHash, signature).returns('0x00000000');
}

/**
 * Expect an ERC1271 contract to have been called once.
 * @param erc1271Instance A fake ERC1271 contract instance.
 * @param orderHash The hash of the order.
 */
async function expectERC1271CalledOnceWith(
    erc1271Instance: FakeContract<IERC1271>,
    orderHash: string,
    signature: string,
) {
    expect(erc1271Instance.isValidSignature).be.have.been.calledOnceWith(orderHash, signature);
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
