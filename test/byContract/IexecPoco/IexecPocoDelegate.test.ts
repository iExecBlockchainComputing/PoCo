// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    App,
    AppRegistry,
    AppRegistry__factory,
    App__factory,
    Dataset,
    DatasetRegistry,
    DatasetRegistry__factory,
    Dataset__factory,
    IexecLibOrders_v5__factory,
    IexecPoco1Delegate,
    IexecPocoAccessorsDelegate__factory,
    IexecPocoCompositeDelegate,
    IexecPocoCompositeDelegate__factory,
    Workerpool,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../../typechain';
import {
    Orders,
    OrdersActors,
    OrdersAssets,
    buildDomain,
    buildOrders,
    hashOrder,
    signOrders,
} from '../../../utils/createOrders';
import { createMock } from '../../../utils/mock-tools';
import { getDealId } from '../../../utils/poco-tools';

chai.use(smock.matchers);

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const schedulerRewardRatio = 1;
const EIP712DOMAIN_SEPARATOR = 'EIP712DOMAIN_SEPARATOR';
const BALANCES = 'm_balances';
const FROZENS = 'm_frozens';
const WORKERPOOL_STAKE_RATIO = 30;
const CALLBACK_GAS = 100000;
const { domain, domainSeparator } = buildDomain();
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const ordersPrices = {
    app: appPrice,
    dataset: datasetPrice,
    workerpool: workerpoolPrice,
};
let [admin, requester, sponsor, beneficiary, appProvider, datasetProvider, scheduler, anyone] =
    [] as SignerWithAddress[];
let ordersActors: OrdersActors;
let iexecPocoInstance: MockContract<IexecPoco1Delegate>;
let appRegistry: FakeContract<AppRegistry>;
let appInstance: MockContract<App>;
let datasetRegistry: FakeContract<DatasetRegistry>;
let datasetInstance: MockContract<Dataset>;
let workerpoolRegistry: FakeContract<WorkerpoolRegistry>;
let workerpoolInstance: MockContract<Workerpool>;
let ordersAssets: OrdersAssets;

describe('IexecPocoDelegate', function () {
    beforeEach('Setup accounts & contracts', async () => {
        // Setup accounts
        [admin, requester, sponsor, beneficiary, appProvider, datasetProvider, scheduler, anyone] =
            await ethers.getSigners();
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        // Deploy contracts with fixture to ensure blockchain is always restored
        // to a snapshot without redeploying everything
        const deployFixture = async () => {
            const iexecLibOrdersInstanceAddress = await new IexecLibOrders_v5__factory()
                .connect(admin)
                .deploy()
                .then((instance) => instance.deployed())
                .then((instance) => instance.address);
            // Using native smock call here for understandability purposes (also works with
            // the custom `createMock` method)
            iexecPocoInstance = (await smock
                .mock<IexecPocoCompositeDelegate__factory>('IexecPocoCompositeDelegate', {
                    libraries: {
                        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                            iexecLibOrdersInstanceAddress,
                    },
                })
                .then((instance) => instance.deploy())
                .then((instance) =>
                    instance.deployed(),
                )) as MockContract<IexecPocoCompositeDelegate>;
            // A global domain separator needs to be set since current contract is being
            // unit tested here (hence no proxy)
            await iexecPocoInstance.setVariable('m_callbackgas', CALLBACK_GAS);
            await iexecPocoInstance.setVariable(EIP712DOMAIN_SEPARATOR, domainSeparator);
            await iexecPocoInstance.setVariable('m_categories', [
                {
                    // Category 0
                    name: 'some-name',
                    description: 'some-description',
                    workClockTimeRef: 60,
                },
            ]);
        };
        await loadFixture(deployFixture);
        // Setup app registry and add app entry
        appRegistry = await smock.fake<AppRegistry>(AppRegistry__factory);
        await iexecPocoInstance.setVariable('m_appregistry', appRegistry.address);
        appInstance = await createMock<App__factory, App>('App');
        appRegistry.isRegistered.whenCalledWith(appInstance.address).returns(true);
        appInstance.owner.returns(appProvider.address);
        // Setup dataset registry and add dataset entry
        datasetInstance = await createMock<Dataset__factory, Dataset>('Dataset');
        datasetRegistry = await smock.fake<DatasetRegistry>(DatasetRegistry__factory);
        await iexecPocoInstance.setVariable('m_datasetregistry', datasetRegistry.address);
        datasetRegistry.isRegistered.whenCalledWith(datasetInstance.address).returns(true);
        datasetInstance.owner.returns(datasetProvider.address);
        // Setup workerpool registry and add workerpool entry
        workerpoolRegistry = await smock.fake<WorkerpoolRegistry>(WorkerpoolRegistry__factory);
        await iexecPocoInstance.setVariable('m_workerpoolregistry', workerpoolRegistry.address);
        workerpoolInstance = await createMock<Workerpool__factory, Workerpool>('Workerpool');
        workerpoolRegistry.isRegistered.whenCalledWith(workerpoolInstance.address).returns(true);
        workerpoolInstance.owner.returns(scheduler.address);
        workerpoolInstance.m_schedulerRewardRatioPolicy.returns(schedulerRewardRatio);
        // Bundle assets together for simplicity purposes
        ordersAssets = {
            app: appInstance.address,
            dataset: datasetInstance.address,
            workerpool: workerpoolInstance.address,
        };
    });

    describe('Match Orders', function () {
        it('Should sponsor match orders ', async function () {
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: ethers.Wallet.createRandom().address,
            });
            // Set volumes for each order
            appOrder.volume = 2; // smallest unconsumed volume among all orders
            datasetOrder.volume = 3;
            workerpoolOrder.volume = 4;
            requestOrder.volume = 5;
            const expectedVolume = 2;
            // Set balance & frozen for each actor
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * expectedVolume;
            const initialIexecPocoBalance = 1;
            const initialRequesterBalance = 2;
            const initialRequesterFrozen = 3;
            const initialSchedulerBalance = 4;
            const initialSchedulerFrozen = 5;
            const initialSponsorBalance = 6;
            const initialSponsorFrozen = 7;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecPocoInstance.setVariables({
                [BALANCES]: {
                    [iexecPocoInstance.address]: initialIexecPocoBalance,
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
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);
            const matchOrdersArgs = [
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            ] as Orders;
            expect(
                await iexecPocoInstance
                    .connect(sponsor)
                    .callStatic.sponsorMatchOrders(...matchOrdersArgs),
            ).to.equal(dealId);
            // Send tx
            await expect(iexecPocoInstance.connect(sponsor).sponsorMatchOrders(...matchOrdersArgs))
                .to.emit(iexecPocoInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                )
                .to.emit(iexecPocoInstance, 'DealSponsored')
                .withArgs(dealId, sponsor.address);
            // Verify Poco contract balance
            await expectBalance(
                iexecPocoInstance,
                iexecPocoInstance.address,
                initialIexecPocoBalance + dealPrice + schedulerStake,
            );
            // Verify requester balance & frozen
            await expectBalance(iexecPocoInstance, requester.address, initialRequesterBalance);
            await expectFrozen(iexecPocoInstance, requester.address, initialRequesterFrozen);
            // Verify sponsor balance & frozen
            await expectBalance(iexecPocoInstance, sponsor.address, initialSponsorBalance);
            await expectFrozen(
                iexecPocoInstance,
                sponsor.address,
                initialSponsorFrozen + dealPrice,
            );
            // Verify scheduler balance & frozen
            await expectBalance(iexecPocoInstance, scheduler.address, initialSchedulerBalance);
            await expectFrozen(
                iexecPocoInstance,
                scheduler.address,
                initialSchedulerFrozen + schedulerStake,
            );
            // Verify stored deal
            expect((await viewDeal(dealId)).sponsor).to.equal(sponsor.address);
        });

        it('Should get empty task', async function () {
            // Covers `viewTask` in tests.
            // Fixes Codecov issue with IexecPocoAccessorsDelegate.
            const task = await IexecPocoAccessorsDelegate__factory.connect(
                iexecPocoInstance.address,
                anyone,
            ).viewTask(ethers.utils.randomBytes(32));
            expect(task.dealid).to.equal(ethers.constants.HashZero);
        });
    });

    /**
     * @notice Smock does not support getting struct variable from a mapping.
     */
    async function viewDeal(dealId: string) {
        return await IexecPocoAccessorsDelegate__factory.connect(
            iexecPocoInstance.address,
            anyone,
        ).viewDeal(dealId);
    }
});

function computeSchedulerDealStake(workerpoolPrice: number, volume: number) {
    return ((workerpoolPrice * WORKERPOOL_STAKE_RATIO) / 100) * volume;
}

async function expectBalance(
    iexecPocoInstance: MockContract<IexecPoco1Delegate>,
    account: string,
    expectedBalanceValue: number,
) {
    expect(await iexecPocoInstance.getVariable(BALANCES, [account])).to.equal(expectedBalanceValue);
}

async function expectFrozen(
    iexecPocoInstance: MockContract<IexecPoco1Delegate>,
    account: string,
    expectedFrozenValue: number,
) {
    expect(await iexecPocoInstance.getVariable(FROZENS, [account])).to.equal(expectedFrozenValue);
}
