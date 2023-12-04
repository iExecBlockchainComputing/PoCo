// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

// Config
var DEPLOYMENT = require('../../../config/config.json').chains.default;
// Artefacts
var RLC = artifacts.require('rlc-faucet-contract/contracts/RLC');
var ERC1538Proxy = artifacts.require('iexec-solidity/ERC1538Proxy');
var IexecInterface = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry = artifacts.require('AppRegistry');
var DatasetRegistry = artifacts.require('DatasetRegistry');
var WorkerpoolRegistry = artifacts.require('WorkerpoolRegistry');
var App = artifacts.require('App');
var Dataset = artifacts.require('Dataset');
var Workerpool = artifacts.require('Workerpool');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools = require('../../../utils/tools');
const enstools = require('../../../utils/ens-tools');
const odbtools = require('../../../utils/odb-tools');
const constants = require('../../../utils/constants');

Object.extract = (obj, keys) => keys.map((key) => obj[key]);

contract('Poco', async (accounts) => {
    assert.isAtLeast(accounts.length, 10, 'should have at least 10 accounts');
    let iexecAdmin = null;
    let appProvider = null;
    let datasetProvider = null;
    let scheduler = null;
    let worker1 = null;
    let worker2 = null;
    let worker3 = null;
    let worker4 = null;
    let worker5 = null;
    let user = null;

    var RLCInstance = null;
    var IexecInstance = null;
    var AppRegistryInstance = null;
    var DatasetRegistryInstance = null;
    var WorkerpoolRegistryInstance = null;

    var AppInstance = null;
    var DatasetInstance = null;
    var WorkerpoolInstance = null;

    var apporder = null;
    var datasetorder = null;
    var workerpoolorder1 = null;
    var workerpoolorder2 = null;
    var requestorder = null;

    var deals = {};
    var tasks = {};

    /***************************************************************************
     *                        Environment configuration                        *
     ***************************************************************************/
    before('configure', async () => {
        console.log('# web3 version:', web3.version);

        /**
         * Retreive deployed contracts
         */
        IexecInstance = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
        AppRegistryInstance = await AppRegistry.deployed();
        DatasetRegistryInstance = await DatasetRegistry.deployed();
        WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
        ERC712_domain = await IexecInstance.domain();
        RLCInstance =
            DEPLOYMENT.asset == 'Native'
                ? { address: constants.NULL.ADDRESS }
                : await RLC.at(await IexecInstance.token());

        broker = new odbtools.Broker(IexecInstance);
        iexecAdmin = new odbtools.iExecAgent(IexecInstance, accounts[0]);
        appProvider = new odbtools.iExecAgent(IexecInstance, accounts[1]);
        datasetProvider = new odbtools.iExecAgent(IexecInstance, accounts[2]);
        scheduler = new odbtools.Scheduler(IexecInstance, accounts[3]);
        worker1 = new odbtools.Worker(IexecInstance, accounts[4]);
        worker2 = new odbtools.Worker(IexecInstance, accounts[5]);
        worker3 = new odbtools.Worker(IexecInstance, accounts[6]);
        worker4 = new odbtools.Worker(IexecInstance, accounts[7]);
        worker5 = new odbtools.Worker(IexecInstance, accounts[8]);
        user = new odbtools.iExecAgent(IexecInstance, accounts[9]);
        await broker.initialize();
    });

    /***************************************************************************
     *                             TEST: deposit                              *
     ***************************************************************************/
    it('[Setup] deposit', async () => {
        switch (DEPLOYMENT.asset) {
            case 'Native':
                await IexecInstance.deposit({
                    from: iexecAdmin.address,
                    value: 10000000 * 10 ** 9,
                });
                break;

            case 'Token':
                await RLCInstance.approveAndCall(IexecInstance.address, 10000000, '0x', {
                    from: iexecAdmin.address,
                });
                break;
        }
        await IexecInstance.transfer(scheduler.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(worker1.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(worker2.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(worker3.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(worker4.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(worker5.address, 1000, { from: iexecAdmin.address });
        await IexecInstance.transfer(user.address, 1000, { from: iexecAdmin.address });
    });

    /***************************************************************************
     *                  TEST: App creation (by appProvider)                  *
     ***************************************************************************/
    it('[Setup]', async () => {
        // Ressources
        txMined = await AppRegistryInstance.createApp(
            appProvider.address,
            'R Clifford Attractors',
            'DOCKER',
            constants.MULTIADDR_BYTES,
            constants.NULL.BYTES32,
            '0x',
            { from: appProvider.address },
        );
        events = tools.extractEvents(txMined, AppRegistryInstance.address, 'Transfer');
        AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));

        txMined = await DatasetRegistryInstance.createDataset(
            datasetProvider.address,
            'Pi',
            constants.MULTIADDR_BYTES,
            constants.NULL.BYTES32,
            { from: datasetProvider.address },
        );
        events = tools.extractEvents(txMined, DatasetRegistryInstance.address, 'Transfer');
        DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));

        txMined = await WorkerpoolRegistryInstance.createWorkerpool(
            scheduler.address,
            'A test workerpool',
            { from: scheduler.address },
        );
        events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, 'Transfer');
        WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));

        await WorkerpoolInstance.changePolicy(
            /* worker stake ratio */ 35,
            /* scheduler reward ratio */ 5,
            { from: scheduler.address },
        );

        // Orders
        apporder = await appProvider.signAppOrder({
            app: AppInstance.address,
            appprice: 3,
            volume: 1000,
            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
            datasetrestrict: constants.NULL.ADDRESS,
            workerpoolrestrict: constants.NULL.ADDRESS,
            requesterrestrict: constants.NULL.ADDRESS,
            salt: web3.utils.randomHex(32),
            sign: constants.NULL.SIGNATURE,
        });
        datasetorder = await datasetProvider.signDatasetOrder({
            dataset: DatasetInstance.address,
            datasetprice: 1,
            volume: 1000,
            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
            apprestrict: constants.NULL.ADDRESS,
            workerpoolrestrict: constants.NULL.ADDRESS,
            requesterrestrict: constants.NULL.ADDRESS,
            salt: web3.utils.randomHex(32),
            sign: constants.NULL.SIGNATURE,
        });
        workerpoolorder_offset = await scheduler.signWorkerpoolOrder({
            workerpool: WorkerpoolInstance.address,
            workerpoolprice: 15,
            volume: 1,
            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
            category: 4,
            trust: 10,
            apprestrict: constants.NULL.ADDRESS,
            datasetrestrict: constants.NULL.ADDRESS,
            requesterrestrict: constants.NULL.ADDRESS,
            salt: web3.utils.randomHex(32),
            sign: constants.NULL.SIGNATURE,
        });
        workerpoolorder = await scheduler.signWorkerpoolOrder({
            workerpool: WorkerpoolInstance.address,
            workerpoolprice: 25,
            volume: 1000,
            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
            category: 4,
            trust: 10,
            apprestrict: constants.NULL.ADDRESS,
            datasetrestrict: constants.NULL.ADDRESS,
            requesterrestrict: constants.NULL.ADDRESS,
            salt: web3.utils.randomHex(32),
            sign: constants.NULL.SIGNATURE,
        });
        requestorder = await user.signRequestOrder({
            app: AppInstance.address,
            appmaxprice: 3,
            dataset: DatasetInstance.address,
            datasetmaxprice: 1,
            workerpool: constants.NULL.ADDRESS,
            workerpoolmaxprice: 25,
            volume: 10,
            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
            category: 4,
            trust: 4,
            requester: user.address,
            beneficiary: user.address,
            callback: constants.NULL.ADDRESS,
            params: '<parameters>',
            salt: web3.utils.randomHex(32),
            sign: constants.NULL.SIGNATURE,
        });

        // Market
        await IexecInstance.matchOrders(
            apporder,
            datasetorder,
            workerpoolorder_offset,
            requestorder,
            { from: user.address },
        );
        await IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, {
            from: user.address,
        });

        deals = await odbtools.utils.requestToDeal(
            IexecInstance,
            odbtools.utils.hashRequestOrder(ERC712_domain, requestorder),
        );
    });

    it('[setup] Initialization', async () => {
        tasks[1] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 1, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // full
        tasks[2] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 2, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // partial to soon
        tasks[3] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 3, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // partial ok
        tasks[4] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 4 }); // uninitialized
        tasks[5] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 5, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // no consensus
        tasks[6] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 6, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // no reveal
        tasks[7] = tools.extractEvents(
            await IexecInstance.initialize(deals[1], 7, { from: scheduler.address }),
            IexecInstance.address,
            'TaskInitialize',
        )[0].args.taskid; // late
    });

    function sendContribution(taskid, worker, results, authorization, enclave) {
        return IexecInstance.contribute(
            taskid, // task (authorization)
            results.hash, // common    (result)
            results.seal, // unique    (result)
            enclave, // address   (enclave)
            results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
            authorization.sign, // signature (authorization)
            { from: worker.address },
        );
    }

    it('[setup] Contribute', async () => {
        await sendContribution(
            tasks[1],
            worker1,
            odbtools.utils.sealResult(tasks[1], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[1], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
        await sendContribution(
            tasks[1],
            worker2,
            odbtools.utils.sealResult(tasks[1], 'true', worker2.address),
            await odbtools.utils.signAuthorization(
                { worker: worker2.address, taskid: tasks[1], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );

        await sendContribution(
            tasks[2],
            worker1,
            odbtools.utils.sealResult(tasks[2], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[2], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
        await sendContribution(
            tasks[2],
            worker2,
            odbtools.utils.sealResult(tasks[2], 'true', worker2.address),
            await odbtools.utils.signAuthorization(
                { worker: worker2.address, taskid: tasks[2], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );

        await sendContribution(
            tasks[3],
            worker1,
            odbtools.utils.sealResult(tasks[3], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[3], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
        await sendContribution(
            tasks[3],
            worker2,
            odbtools.utils.sealResult(tasks[3], 'true', worker2.address),
            await odbtools.utils.signAuthorization(
                { worker: worker2.address, taskid: tasks[3], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );

        await sendContribution(
            tasks[5],
            worker1,
            odbtools.utils.sealResult(tasks[5], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[5], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );

        await sendContribution(
            tasks[6],
            worker1,
            odbtools.utils.sealResult(tasks[6], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[6], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
        await sendContribution(
            tasks[6],
            worker2,
            odbtools.utils.sealResult(tasks[6], 'true', worker2.address),
            await odbtools.utils.signAuthorization(
                { worker: worker2.address, taskid: tasks[6], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );

        await sendContribution(
            tasks[7],
            worker1,
            odbtools.utils.sealResult(tasks[7], 'true', worker1.address),
            await odbtools.utils.signAuthorization(
                { worker: worker1.address, taskid: tasks[7], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
        await sendContribution(
            tasks[7],
            worker2,
            odbtools.utils.sealResult(tasks[7], 'true', worker2.address),
            await odbtools.utils.signAuthorization(
                { worker: worker2.address, taskid: tasks[7], enclave: constants.NULL.ADDRESS },
                scheduler.wallet,
            ),
            constants.NULL.ADDRESS,
        );
    });

    it('[setup] Reveal', async () => {
        await IexecInstance.reveal(tasks[1], odbtools.utils.hashResult(tasks[1], 'true').digest, {
            from: worker1.address,
        });
        await IexecInstance.reveal(tasks[1], odbtools.utils.hashResult(tasks[1], 'true').digest, {
            from: worker2.address,
        });
        await IexecInstance.reveal(tasks[2], odbtools.utils.hashResult(tasks[2], 'true').digest, {
            from: worker1.address,
        });
        await IexecInstance.reveal(tasks[3], odbtools.utils.hashResult(tasks[3], 'true').digest, {
            from: worker1.address,
        });
        await IexecInstance.reveal(tasks[7], odbtools.utils.hashResult(tasks[7], 'true').digest, {
            from: worker1.address,
        });
    });

    it('[4.1] Finalize - Correct (full)', async () => {
        txMined = await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex('aResult 1'), '0x', {
            from: scheduler.address,
        });
        events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
        assert.equal(events[0].args.taskid, tasks[1], 'check taskid');
        assert.equal(
            events[0].args.results,
            web3.utils.utf8ToHex('aResult 1'),
            'check consensus (results)',
        );
    });

    it('[4.2] Finalize - Error (partial - soon)', async () => {
        await expectRevert.unspecified(
            IexecInstance.finalize(tasks[2], web3.utils.utf8ToHex('aResult 2'), '0x', {
                from: scheduler.address,
            }),
        );
    });

    it('clock fast forward', async () => {
        target = Number((await IexecInstance.viewTask(tasks[3])).revealDeadline);

        await web3.currentProvider.send(
            {
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [target - (await web3.eth.getBlock('latest')).timestamp],
                id: 0,
            },
            () => {},
        );
        // workaround for https://github.com/trufflesuite/ganache/issues/1033
        await web3.currentProvider.send(
            { jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0 },
            () => {},
        );
    });

    it('[4.3] Finalize - Correct (partial - wait)', async () => {
        txMined = await IexecInstance.finalize(tasks[3], web3.utils.utf8ToHex('aResult 3'), '0x', {
            from: scheduler.address,
        });
        assert.isBelow(
            txMined.receipt.gasUsed,
            constants.AMOUNT_GAS_PROVIDED,
            'should not use all gas',
        );
        events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
        assert.equal(events[0].args.taskid, tasks[3], 'check taskid');
        assert.equal(
            events[0].args.results,
            web3.utils.utf8ToHex('aResult 3'),
            'check consensus (results)',
        );
    });

    it('[4.4] Finalize - Error (no contribution)', async () => {
        await expectRevert.unspecified(
            IexecInstance.finalize(tasks[4], web3.utils.utf8ToHex('aResult 4'), '0x', {
                from: scheduler.address,
            }),
        );
    });

    it('[4.5] Finalize - Error (no consensus)', async () => {
        await expectRevert.unspecified(
            IexecInstance.finalize(tasks[5], web3.utils.utf8ToHex('aResult 5'), '0x', {
                from: scheduler.address,
            }),
        );
    });

    it('[4.6] Finalize - Error (no reveal)', async () => {
        await expectRevert.unspecified(
            IexecInstance.finalize(tasks[6], web3.utils.utf8ToHex('aResult 6'), '0x', {
                from: scheduler.address,
            }),
        );
    });

    it('clock fast forward', async () => {
        target = Number((await IexecInstance.viewTask(tasks[7])).finalDeadline);

        await web3.currentProvider.send(
            {
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [target - (await web3.eth.getBlock('latest')).timestamp],
                id: 0,
            },
            () => {},
        );
        // workaround for https://github.com/trufflesuite/ganache/issues/1033
        await web3.currentProvider.send(
            { jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0 },
            () => {},
        );
    });

    it('[4.7] Finalize - Error (late)', async () => {
        await expectRevert.unspecified(
            IexecInstance.finalize(tasks[7], web3.utils.utf8ToHex('aResult 7'), '0x', {
                from: scheduler.address,
            }),
        );
    });
});
