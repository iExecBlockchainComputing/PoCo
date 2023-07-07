import { smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from '@ethersproject/contracts';
import {
    createEmptyRequestOrder,
    createEmptyAppOrder,
    createEmptyWorkerpoolOrder,
} from '../../../utils/createOrders';
import {
    IexecPocoBoostDelegate__factory,
    IexecPocoBoostDelegate,
    App__factory,
} from '../../../typechain';

async function deployBoostFixture() {
    const [admin, requester, beneficiary, appProvider, datasetProvider, scheduler, worker1] =
        await ethers.getSigners();
    const iexecPocoBoostInstance: IexecPocoBoostDelegate =
        await new IexecPocoBoostDelegate__factory()
            .connect(admin)
            .deploy()
            .then((instance) => instance.deployed());
    return {
        iexecPocoBoostInstance,
        admin,
        requester,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
    };
}

async function createMockApp() {
    const appInstance = await smock
        .mock<App__factory>('App')
        .then((contract) => contract.deploy())
        .then((instance) => instance.deployed());
    return appInstance;
}

describe('Match orders boost', function () {
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let appProvider: SignerWithAddress;
    let appInstance: Contract;

    beforeEach('set up contract instances and mock app', async () => {
        const fixtures = await loadFixture(deployBoostFixture);
        iexecPocoBoostInstance = fixtures.iexecPocoBoostInstance;
        appProvider = fixtures.appProvider;
        appInstance = await createMockApp();
    });

    it('Should match orders', async function () {
        const appAddress = appInstance.address;
        appInstance.owner.returns(appProvider.address);

        const dealId = '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f';
        const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

        let appOrder = createEmptyAppOrder();
        let requestOrder = createEmptyRequestOrder();
        let workerpoolOrder = createEmptyWorkerpoolOrder();
        // Set app address
        appOrder.app = appAddress;
        requestOrder.app = appAddress;
        // Set tag
        appOrder.tag = dealTag;
        requestOrder.tag = dealTag;

        await expect(iexecPocoBoostInstance.matchOrdersBoost(requestOrder, appOrder))
            .to.emit(iexecPocoBoostInstance, 'OrdersMatchedBoost')
            .withArgs(dealId);

        const deal = await iexecPocoBoostInstance.viewDealBoost(dealId);
        expect(deal.appOwner).to.be.equal(appProvider.address);
        expect(deal.tag).to.be.equal(dealTag);
    });

    it('Should fail when trust is not zero', async function () {
        const appAddress = appInstance.address;

        const dealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

        let appOrder = createEmptyAppOrder();
        let requestOrder = createEmptyRequestOrder();
        // Set app address
        appOrder.app = appAddress;
        requestOrder.app = appAddress;
        // Set same tags
        appOrder.tag = dealTag;
        requestOrder.tag = dealTag;
        // Set non-zero trust
        requestOrder.trust = 1;

        await expect(
            iexecPocoBoostInstance.matchOrdersBoost(requestOrder, appOrder),
        ).to.be.revertedWith('MatchOrdersBoost: Trust level is not zero');
    });
});
