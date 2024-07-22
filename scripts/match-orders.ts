// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataDomain } from 'ethers';
import { ethers } from 'hardhat';
import { IexecWrapper } from '../test/utils/IexecWrapper';
import { IexecPocoBoost, IexecPocoBoost__factory } from '../typechain';
import {
    Orders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../utils/createOrders';
import {
    IexecAccounts,
    buildAndSignContributionAuthorizationMessage,
    buildAndSignEnclaveMessage,
    buildUtf8ResultAndDigest,
    getDealId,
    getTaskId,
} from '../utils/poco-tools';

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0;
const volume = taskIndex + 1;
const appPrice = 0;
const datasetPrice = 0;
const workerpoolPrice = 0;

(async function () {
    const signers = await ethers.getSigners();
    const accounts: IexecAccounts = {
        iexecAdmin: signers[0],
        requester: signers[0],
        sponsor: signers[0],
        beneficiary: signers[0],
        appProvider: signers[0],
        datasetProvider: signers[0],
        scheduler: signers[0],
        worker: signers[0],
        worker1: signers[0],
        worker2: signers[0],
        worker3: signers[0],
        worker4: signers[0],
        enclave: signers[0],
        sms: signers[0],
        anyone: signers[0],
    };

    const {
        iexecAdmin,
        requester,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker,
        enclave,
    } = accounts;

    const balance = (await iexecAdmin.getBalance()).toBigInt();
    console.log('Deployer address:', iexecAdmin.address);
    console.log('Deployer balance:', ethers.utils.formatEther(balance), 'ETH');

    const proxyAddress = '0x44b090A1FF9779100A39a5CeFbD5659Ad98b442f';
    // const iexecAccessor: IexecAccessors = IexecAccessors__factory.connect(proxyAddress, anyone);
    const iexecPoco: IexecPocoBoost = IexecPocoBoost__factory.connect(proxyAddress, iexecAdmin);
    const iexecWrapper: IexecWrapper = new IexecWrapper(proxyAddress, accounts);

    const domain: TypedDataDomain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: proxyAddress,
    };

    // const { appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets();
    const appAddress = '0xb868ea091cbb284dd46072e3cbdb7f2e913fb8e9';
    const datasetAddress = '0x9c8613b81cc1a518fe3ada58d99e0b4d666c333e';
    const workerpoolAddress = '0x69ac3dae9c935e4f95c933c3ac6b272d42d65e41';

    const ordersActors: OrdersActors = {
        appOwner: appProvider,
        datasetOwner: datasetProvider,
        workerpoolOwner: scheduler,
        requester: requester,
    };
    const ordersAssets: OrdersAssets = {
        app: appAddress,
        dataset: datasetAddress,
        workerpool: workerpoolAddress,
    };
    const ordersPrices: OrdersPrices = {
        app: appPrice,
        dataset: datasetPrice,
        workerpool: workerpoolPrice,
    };

    const callbackAddress = ethers.constants.AddressZero;
    const { orders, appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
        assets: ordersAssets,
        requester: requester.address,
        beneficiary: beneficiary.address,
        tag: teeDealTag,
        prices: ordersPrices,
        callback: callbackAddress,
    });
    console.log('Signing orders');
    await signOrders(domain, orders, ordersActors);
    const matchOrdersArgs = [appOrder, datasetOrder, workerpoolOrder, requestOrder] as Orders;

    console.log('Matching orders');
    const matchTx = await iexecPoco.matchOrdersBoost(...matchOrdersArgs);
    console.log('MatchTx id:', matchTx.hash);
    await matchTx.wait();

    console.log('Pushing result');
    const dealId = getDealId(domain, requestOrder, taskIndex);
    console.log('dealId:', dealId);
    const taskId = getTaskId(dealId, taskIndex);
    console.log('taskId:', taskId);
    const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
        worker.address,
        taskId,
        enclave.address,
        scheduler,
    );
    const { results, resultDigest } = buildUtf8ResultAndDigest('result');
    const enclaveSignature = await buildAndSignEnclaveMessage(
        worker.address,
        taskId,
        resultDigest,
        enclave,
    );
    const pushResultTx = await iexecPoco
        .connect(worker)
        .pushResultBoost(
            dealId,
            taskIndex,
            results,
            ethers.constants.HashZero,
            schedulerSignature,
            enclave.address,
            enclaveSignature,
        );
    console.log('pushResultTx id:', pushResultTx.hash);
    await pushResultTx.wait();
})();
