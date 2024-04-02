// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain } from 'ethers';
import hre, { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import { IexecAccessors, IexecAccessors__factory } from '../typechain';
import { IexecPoco1 } from '../typechain/contracts/modules/interfaces/IexecPoco1.v8.sol';
import { IexecPoco1__factory } from '../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol';
import { IexecWrapper } from '../utils/IexecWrapper';
import {
    Orders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    hashOrder,
    signOrders,
} from '../utils/createOrders';
import { getDealId, getIexecAccounts } from '../utils/poco-tools';

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;

describe('IexecPocoDelegate', function () {
    let domain: TypedDataDomain;
    let proxyAddress: string;
    let iexecAccessor: IexecAccessors;
    let iexecPoco: IexecPoco1;
    let iexecWrapper: IexecWrapper;
    let appAddress = '';
    let workerpoolAddress = '';
    let datasetAddress = '';
    let [
        iexecAdmin,
        requester,
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        anyone,
    ]: SignerWithAddress[] = [];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            iexecAdmin,
            requester,
            sponsor,
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            anyone,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
        iexecPoco = IexecPoco1__factory.connect(proxyAddress, iexecAdmin);
        iexecAccessor = IexecAccessors__factory.connect(proxyAddress, anyone);
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        domain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: hre.network.config.chainId,
            verifyingContract: proxyAddress,
        };
        ordersAssets = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
        };
        ordersPrices = {
            app: appPrice,
            dataset: datasetPrice,
            workerpool: workerpoolPrice,
        };
    }

    describe('MatchOrders', function () {
        it('Should sponsor match orders (TEE)', async function () {
            const callbackAddress = ethers.Wallet.createRandom().address;
            const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: callbackAddress,
            });
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                1; // volume
            expect(await iexecAccessor.balanceOf(iexecAccessor.address)).to.be.equal(0);
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            expect(await iexecAccessor.balanceOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecAccessor.frozenOf(sponsor.address)).to.be.equal(0);
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(requester.address)).to.be.equal(0);
            // Deposit RLC in the scheduler's account.
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            expect(await iexecAccessor.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecAccessor.frozenOf(scheduler.address)).to.be.equal(0);
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
                await iexecPoco.connect(sponsor).callStatic.sponsorMatchOrders(...matchOrdersArgs),
            ).to.equal(dealId);
            await expect(iexecPoco.connect(sponsor).sponsorMatchOrders(...matchOrdersArgs))
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                )
                .to.emit(iexecPoco, 'DealSponsored')
                .withArgs(dealId, sponsor.address);
            expect(await iexecAccessor.balanceOf(iexecAccessor.address)).to.be.equal(
                dealPrice + schedulerStake,
            );
            expect(await iexecAccessor.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecAccessor.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecAccessor.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
            const deal = await iexecAccessor.viewDeal(dealId);
            expect(deal.sponsor).to.be.equal(sponsor.address);
        });
    });
});
