// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { randomAddress } from '../../utils/utils';

const appPrice = 1;
const datasetPrice = 2;
const workerpoolPrice = 3;
const volume = 4;
const category = 5;
const trust = 6n;
const tag = ethers.id('tag');
const salt = ethers.id('salt');
let sign: string;

describe('IexecRelay', async () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceNative;
    let [app, dataset, workerpool, requester, beneficiary]: string[] = [];

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, accounts.anyone);
        [app, dataset, workerpool, requester, beneficiary] = Array(5).fill(randomAddress());
        sign = await ethers.Wallet.createRandom().signMessage('sign');
    }

    it('Should broadcast app order', async () => {
        const appOrder: IexecLibOrders_v5.AppOrderStruct = {
            app: app,
            appprice: appPrice,
            volume,
            tag,
            datasetrestrict: dataset,
            workerpoolrestrict: workerpool,
            requesterrestrict: requester,
            salt,
            sign,
        };
        await expect(iexecPoco.broadcastAppOrder(appOrder))
            .to.emit(iexecPoco, 'BroadcastAppOrder')
            .withArgs(Object.values(appOrder));
    });

    it('Should broadcast dataset order', async () => {
        const datasetOrder: IexecLibOrders_v5.DatasetOrderStruct = {
            dataset: dataset,
            datasetprice: datasetPrice,
            volume,
            tag,
            apprestrict: app,
            workerpoolrestrict: workerpool,
            requesterrestrict: requester,
            salt,
            sign,
        };
        await expect(iexecPoco.broadcastDatasetOrder(datasetOrder))
            .to.emit(iexecPoco, 'BroadcastDatasetOrder')
            .withArgs(Object.values(datasetOrder));
    });

    it('Should broadcast workerpool order', async () => {
        const workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct = {
            workerpool: workerpool,
            workerpoolprice: workerpoolPrice,
            volume,
            tag,
            category,
            trust,
            apprestrict: app,
            datasetrestrict: dataset,
            requesterrestrict: requester,
            salt,
            sign,
        };
        await expect(iexecPoco.broadcastWorkerpoolOrder(workerpoolOrder))
            .to.emit(iexecPoco, 'BroadcastWorkerpoolOrder')
            .withArgs(Object.values(workerpoolOrder));
    });

    it('Should broadcast request order', async () => {
        const requestOrder: IexecLibOrders_v5.RequestOrderStruct = {
            app: app,
            appmaxprice: appPrice,
            dataset: dataset,
            datasetmaxprice: datasetPrice,
            workerpool: workerpool,
            workerpoolmaxprice: workerpoolPrice,
            requester,
            volume,
            tag,
            category,
            trust,
            beneficiary,
            callback: randomAddress(),
            params: 'params',
            salt,
            sign,
        };
        await expect(iexecPoco.broadcastRequestOrder(requestOrder))
            .to.emit(iexecPoco, 'BroadcastRequestOrder')
            .withArgs(Object.values(requestOrder));
    });
});
