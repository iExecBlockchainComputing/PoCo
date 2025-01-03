// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNativeABILegacy,
    IexecInterfaceNativeABILegacy__factory,
    IexecInterfaceNative__factory,
} from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import {
    ContributionStatusEnum,
    TaskStatusEnum,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const volume = 1;
const trust = 1;
const categoryId = 1;
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const callbackAddress = ethers.Wallet.createRandom().address;
const dealParams = 'params';
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const taskIndex = 0;

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecPocoABILegacy: IexecInterfaceNativeABILegacy;
let iexecWrapper: IexecWrapper;
let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
let [
    requester,
    beneficiary,
    appProvider,
    datasetProvider,
    scheduler,
    anyone,
    worker1,
]: SignerWithAddress[] = [];
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;
let [dealId, taskId, resultHash, resultSeal]: string[] = [];

describe('[ABILegacy] Integration tests', function () {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, beneficiary, appProvider, datasetProvider, scheduler, anyone, worker1 } =
            accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoABILegacy = IexecInterfaceNativeABILegacy__factory.connect(proxyAddress, anyone);
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
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
        // Create deal and finalize a task.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust,
            category: categoryId,
            params: dealParams,
        });
        ({ dealId } = await iexecWrapper.signAndMatchOrders(...orders.toArray()));
        taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
        ({ resultHash, resultSeal } = buildResultHashAndResultSeal(taskId, resultDigest, worker1));
        await iexecWrapper.contributeToTask(dealId, taskIndex, resultDigest, worker1);
    }

    it('[ABILegacy] Should return deal part1', async function () {
        const dealPart1 = await iexecPocoABILegacy.viewDealABILegacy_pt1(dealId);
        expect(dealPart1.length).to.equal(9);
        expect(dealPart1[0]).to.equal(appAddress);
        expect(dealPart1[1]).to.equal(appProvider.address);
        expect(dealPart1[2]).to.equal(appPrice);
        expect(dealPart1[3]).to.equal(datasetAddress);
        expect(dealPart1[4]).to.equal(datasetProvider.address);
        expect(dealPart1[5]).to.equal(datasetPrice);
        expect(dealPart1[6]).to.equal(workerpoolAddress);
        expect(dealPart1[7]).to.equal(scheduler.address);
        expect(dealPart1[8]).to.equal(workerpoolPrice);
    });

    it('[ABILegacy] Should return deal part2', async function () {
        const dealPart2 = await iexecPocoABILegacy.viewDealABILegacy_pt2(dealId);
        expect(dealPart2.length).to.equal(6);
        expect(dealPart2[0]).to.equal(trust);
        expect(dealPart2[1]).to.equal(standardDealTag);
        expect(dealPart2[2]).to.equal(requester.address);
        expect(dealPart2[3]).to.equal(beneficiary.address);
        expect(dealPart2[4]).to.equal(callbackAddress);
        expect(dealPart2[5]).to.equal(dealParams);
    });

    it('[ABILegacy] Should return deal config', async function () {
        const dealConfig = await iexecPocoABILegacy.viewConfigABILegacy(dealId);
        expect(dealConfig.length).to.equal(6);
        expect(dealConfig[0]).to.equal(categoryId);
        expect(dealConfig[1]).to.be.greaterThan(0); // startTime
        expect(dealConfig[2]).to.equal(taskIndex); // botFirst
        expect(dealConfig[3]).to.equal(volume); // botSize
        expect(dealConfig[4]).to.be.greaterThan(0); // workerStake
        expect(dealConfig[5]).to.be.greaterThan(0); // schedulerRewardRatio
    });

    it('[ABILegacy] Should return account', async function () {
        const balanceAmount = 3;
        await iexecWrapper.depositInIexecAccount(requester, balanceAmount);
        const account = await iexecPocoABILegacy.viewAccountABILegacy(requester.address);
        expect(account.length).to.equal(2);
        expect(account[0]).to.equal(balanceAmount); // Balance
        expect(account[1]).to.be.greaterThan(0); // Frozen
    });

    it('[ABILegacy] Should return task', async function () {
        const task = await iexecPocoABILegacy.viewTaskABILegacy(taskId);
        expect(task.length).to.equal(12);
        expect(task[0]).to.equal(TaskStatusEnum.REVEALING);
        expect(task[1]).to.equal(dealId);
        expect(task[2]).to.equal(taskIndex);
        expect(task[3]).to.be.greaterThan(0); // timeref
        expect(task[4]).to.be.greaterThan(0); // contributionDeadline
        expect(task[5]).to.be.greaterThan(0); // revealDeadline
        expect(task[6]).to.be.greaterThan(0); // finalDeadline
        expect(task[7]).to.equal(resultHash); // consensusValue
        expect(task[8]).to.equal(0); // revealCounter
        expect(task[9]).to.equal(1); // winnerCounter
        expect(task[10]).to.equal([worker1]); // contributors
        expect(task[11]).to.equal(results);
    });

    it('[ABILegacy] Should return contribution', async function () {
        const contribution = await iexecPocoABILegacy.viewContributionABILegacy(
            taskId,
            worker1.address,
        );
        expect(contribution.length).to.equal(4);
        expect(contribution[0]).to.equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution[1]).to.equal(resultHash);
        expect(contribution[2]).to.equal(resultSeal);
        expect(contribution[3]).to.equal(AddressZero); // enclaveChallenge
    });

    it('[ABILegacy] Should return category', async function () {
        const category = await iexecPocoABILegacy.viewCategoryABILegacy(1);
        expect(category[0]).to.equal('S');
        expect(category[1]).to.equal('{}');
        expect(category[2]).to.equal(1200);
    });
});
