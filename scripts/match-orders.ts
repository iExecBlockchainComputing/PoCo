// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataDomain } from 'ethers';
import { ethers } from 'hardhat';
import { IexecWrapper } from '../test/utils/IexecWrapper';
import { IexecPoco1 } from '../typechain/contracts/modules/interfaces/IexecPoco1.v8.sol';
import { IexecPoco1__factory } from '../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol';
import {
    Orders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../utils/createOrders';
import { IexecAccounts } from '../utils/poco-tools';

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
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        anyone,
    } = accounts;

    const proxyAddress = '0x44b090A1FF9779100A39a5CeFbD5659Ad98b442f';
    // const iexecAccessor: IexecAccessors = IexecAccessors__factory.connect(proxyAddress, anyone);
    const iexecPoco: IexecPoco1 = IexecPoco1__factory.connect(proxyAddress, iexecAdmin);
    const iexecWrapper: IexecWrapper = new IexecWrapper(proxyAddress, accounts);

    const domain: TypedDataDomain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: proxyAddress,
    };

    const { appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets();

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

    const callbackAddress = ethers.Wallet.createRandom().address;
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
    const tx = await iexecPoco.matchOrders(...matchOrdersArgs);
    console.log('Tx id:', tx.hash);
    await tx.wait();
})();
