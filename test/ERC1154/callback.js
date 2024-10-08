// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const loadTruffleFixtureDeployment = require('../../scripts/truffle-fixture-deployer');
// Config
var DEPLOYMENT = require('../../config/config.json').chains.default;
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

var TestClient = artifacts.require('./TestClient.sol');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools = require('../../utils/tools');
const enstools = require('../../utils/ens-tools');
const odbtools = require('../../utils/odb-tools');
const constants = require('../../utils/constants');

Object.extract = (obj, keys) => keys.map((key) => obj[key]);

contract('ERC1154: callback', async (accounts) => {
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
    var workerpoolorder = null;
    var requestorder1 = null;
    var requestorder2 = null;
    var requestorder3 = null;

    var deals = {};
    var tasks = {};

    var TestClientInstance = null;

    /***************************************************************************
     *                        Environment configuration                        *
     ***************************************************************************/
    before('configure', async () => {
        await loadTruffleFixtureDeployment();
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

        TestClientInstance = await TestClient.new();
    });

    describe('→ setup', async () => {
        describe('assets', async () => {
            describe('app', async () => {
                it('create', async () => {
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
                });
            });

            describe('dataset', async () => {
                it('create', async () => {
                    txMined = await DatasetRegistryInstance.createDataset(
                        datasetProvider.address,
                        'Pi',
                        constants.MULTIADDR_BYTES,
                        constants.NULL.BYTES32,
                        { from: datasetProvider.address },
                    );
                    events = tools.extractEvents(
                        txMined,
                        DatasetRegistryInstance.address,
                        'Transfer',
                    );
                    DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));
                });
            });

            describe('workerpool', async () => {
                it('create', async () => {
                    txMined = await WorkerpoolRegistryInstance.createWorkerpool(
                        scheduler.address,
                        'A test workerpool',
                        { from: scheduler.address },
                    );
                    events = tools.extractEvents(
                        txMined,
                        WorkerpoolRegistryInstance.address,
                        'Transfer',
                    );
                    WorkerpoolInstance = await Workerpool.at(
                        tools.BN2Address(events[0].args.tokenId),
                    );
                });

                it('change policy', async () => {
                    await WorkerpoolInstance.changePolicy(
                        /* worker stake ratio */ 35,
                        /* scheduler reward ratio */ 5,
                        { from: scheduler.address },
                    );
                });
            });
        });

        describe('tokens', async () => {
            it('balances before', async () => {
                assert.deepEqual(await appProvider.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await datasetProvider.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await scheduler.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await worker1.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await worker2.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await worker3.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await worker4.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await worker5.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await user.viewAccount(), [0, 0], 'check balance');
            });

            it('deposit', async () => {
                switch (DEPLOYMENT.asset) {
                    case 'Native':
                        txMined = await IexecInstance.deposit({
                            from: iexecAdmin.address,
                            value: 10000000 * 10 ** 9,
                        });
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .from,
                            constants.NULL.ADDRESS,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .to,
                            iexecAdmin.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .value,
                            10000000,
                        );
                        break;

                    case 'Token':
                        txMined = await RLCInstance.approveAndCall(
                            IexecInstance.address,
                            10000000,
                            '0x',
                            { from: iexecAdmin.address },
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Approval')[0].args
                                .owner,
                            iexecAdmin.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Approval')[0].args
                                .spender,
                            IexecInstance.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Approval')[0].args
                                .value,
                            10000000,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Transfer')[0].args
                                .from,
                            iexecAdmin.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Transfer')[0].args
                                .to,
                            IexecInstance.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, RLCInstance.address, 'Transfer')[0].args
                                .value,
                            10000000,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .from,
                            constants.NULL.ADDRESS,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .to,
                            iexecAdmin.address,
                        );
                        assert.equal(
                            tools.extractEvents(txMined, IexecInstance.address, 'Transfer')[0].args
                                .value,
                            10000000,
                        );
                        break;
                }

                const txsMined = [
                    await IexecInstance.transfer(scheduler.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(worker1.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(worker2.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(worker3.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(worker4.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(worker5.address, 1000, {
                        from: iexecAdmin.address,
                    }),
                    await IexecInstance.transfer(user.address, 1000, { from: iexecAdmin.address }),
                ];

                assert.equal(
                    tools.extractEvents(txsMined[0], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[0], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[1], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[1], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[2], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[2], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[3], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[3], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[4], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[4], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[5], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[5], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
                assert.equal(
                    tools.extractEvents(txsMined[6], IexecInstance.address, 'Transfer')[0].args
                        .from,
                    iexecAdmin.address,
                );
                assert.equal(
                    tools.extractEvents(txsMined[6], IexecInstance.address, 'Transfer')[0].args
                        .value,
                    1000,
                );
            });

            it('balances after', async () => {
                assert.deepEqual(await appProvider.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await datasetProvider.viewAccount(), [0, 0], 'check balance');
                assert.deepEqual(await scheduler.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await worker1.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await worker2.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await worker3.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await worker4.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await worker5.viewAccount(), [1000, 0], 'check balance');
                assert.deepEqual(await user.viewAccount(), [1000, 0], 'check balance');
            });
        });

        it('score', async () => {
            assert.equal(await worker1.viewScore(), 0, 'score issue');
            assert.equal(await worker2.viewScore(), 0, 'score issue');
            assert.equal(await worker3.viewScore(), 0, 'score issue');
            assert.equal(await worker4.viewScore(), 0, 'score issue');
            assert.equal(await worker5.viewScore(), 0, 'score issue');
        });
    });

    describe('→ pipeline', async () => {
        describe('[0] orders', async () => {
            describe('app', async () => {
                it('sign', async () => {
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
                });

                it('verify', async () => {
                    assert.isTrue(
                        await IexecInstance.verifySignature(
                            appProvider.address,
                            odbtools.utils.hashAppOrder(ERC712_domain, apporder),
                            apporder.sign,
                        ),
                    );
                });
            });

            describe('dataset', async () => {
                it('sign', async () => {
                    datasetorder = await datasetProvider.signDatasetOrder({
                        dataset: DatasetInstance.address,
                        datasetprice: 0,
                        volume: 1000,
                        tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                        apprestrict: constants.NULL.ADDRESS,
                        workerpoolrestrict: constants.NULL.ADDRESS,
                        requesterrestrict: constants.NULL.ADDRESS,
                        salt: web3.utils.randomHex(32),
                        sign: constants.NULL.SIGNATURE,
                    });
                });

                it('verify', async () => {
                    assert.isTrue(
                        await IexecInstance.verifySignature(
                            datasetProvider.address,
                            odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder),
                            datasetorder.sign,
                        ),
                    );
                });
            });

            describe('workerpool', async () => {
                it('sign', async () => {
                    workerpoolorder = await scheduler.signWorkerpoolOrder({
                        workerpool: WorkerpoolInstance.address,
                        workerpoolprice: 25,
                        volume: 1000,
                        category: 4,
                        trust: 0,
                        tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                        apprestrict: constants.NULL.ADDRESS,
                        datasetrestrict: constants.NULL.ADDRESS,
                        requesterrestrict: constants.NULL.ADDRESS,
                        salt: web3.utils.randomHex(32),
                        sign: constants.NULL.SIGNATURE,
                    });
                });

                it('verify', async () => {
                    assert.isTrue(
                        await IexecInstance.verifySignature(
                            scheduler.address,
                            odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder),
                            workerpoolorder.sign,
                        ),
                    );
                });
            });

            describe('request', async () => {
                describe('no callback', async () => {
                    it('sign', async () => {
                        requestorder1 = await user.signRequestOrder({
                            app: AppInstance.address,
                            appmaxprice: 3,
                            dataset: DatasetInstance.address,
                            datasetmaxprice: 0,
                            workerpool: constants.NULL.ADDRESS,
                            workerpoolmaxprice: 25,
                            volume: 1,
                            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                            category: 4,
                            trust: 0,
                            requester: user.address,
                            beneficiary: user.address,
                            callback: constants.NULL.ADDRESS,
                            params: '<parameters>',
                            salt: web3.utils.randomHex(32),
                            sign: constants.NULL.SIGNATURE,
                        });
                    });

                    it('verify', async () => {
                        assert.isTrue(
                            await IexecInstance.verifySignature(
                                user.address,
                                odbtools.utils.hashRequestOrder(ERC712_domain, requestorder1),
                                requestorder1.sign,
                            ),
                        );
                    });
                });

                describe('invalid callback', async () => {
                    it('sign', async () => {
                        requestorder2 = await user.signRequestOrder({
                            app: AppInstance.address,
                            appmaxprice: 3,
                            dataset: DatasetInstance.address,
                            datasetmaxprice: 0,
                            workerpool: constants.NULL.ADDRESS,
                            workerpoolmaxprice: 25,
                            volume: 1,
                            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                            category: 4,
                            trust: 0,
                            requester: user.address,
                            beneficiary: user.address,
                            callback: AppInstance.address,
                            params: '<parameters>',
                            salt: web3.utils.randomHex(32),
                            sign: constants.NULL.SIGNATURE,
                        });
                    });

                    it('verify', async () => {
                        assert.isTrue(
                            await IexecInstance.verifySignature(
                                user.address,
                                odbtools.utils.hashRequestOrder(ERC712_domain, requestorder2),
                                requestorder2.sign,
                            ),
                        );
                    });
                });

                describe('valid callback', async () => {
                    it('sign', async () => {
                        requestorder3 = await user.signRequestOrder({
                            app: AppInstance.address,
                            appmaxprice: 3,
                            dataset: DatasetInstance.address,
                            datasetmaxprice: 0,
                            workerpool: constants.NULL.ADDRESS,
                            workerpoolmaxprice: 25,
                            volume: 1,
                            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                            category: 4,
                            trust: 0,
                            requester: user.address,
                            beneficiary: user.address,
                            callback: TestClientInstance.address,
                            params: '<parameters>',
                            salt: web3.utils.randomHex(32),
                            sign: constants.NULL.SIGNATURE,
                        });
                    });

                    it('verify', async () => {
                        assert.isTrue(
                            await IexecInstance.verifySignature(
                                user.address,
                                odbtools.utils.hashRequestOrder(ERC712_domain, requestorder3),
                                requestorder3.sign,
                            ),
                        );
                    });
                });

                describe('callback EOA', async () => {
                    it('sign', async () => {
                        requestorder4 = await user.signRequestOrder({
                            app: AppInstance.address,
                            appmaxprice: 3,
                            dataset: DatasetInstance.address,
                            datasetmaxprice: 0,
                            workerpool: constants.NULL.ADDRESS,
                            workerpoolmaxprice: 25,
                            volume: 1,
                            tag: '0x0000000000000000000000000000000000000000000000000000000000000000',
                            category: 4,
                            trust: 0,
                            requester: user.address,
                            beneficiary: user.address,
                            callback: '0x0000000000000000000000000000000000000001',
                            params: '<parameters>',
                            salt: web3.utils.randomHex(32),
                            sign: constants.NULL.SIGNATURE,
                        });
                    });

                    it('verify', async () => {
                        assert.isTrue(
                            await IexecInstance.verifySignature(
                                user.address,
                                odbtools.utils.hashRequestOrder(ERC712_domain, requestorder4),
                                requestorder4.sign,
                            ),
                        );
                    });
                });
            });
        });

        describe('[1] order matching', async () => {
            it('[TX] match', async () => {
                const txsMined = [
                    await IexecInstance.matchOrders(
                        apporder,
                        datasetorder,
                        workerpoolorder,
                        requestorder1,
                        { from: user.address },
                    ),
                    await IexecInstance.matchOrders(
                        apporder,
                        datasetorder,
                        workerpoolorder,
                        requestorder2,
                        { from: user.address },
                    ),
                    await IexecInstance.matchOrders(
                        apporder,
                        datasetorder,
                        workerpoolorder,
                        requestorder3,
                        { from: user.address },
                    ),
                    await IexecInstance.matchOrders(
                        apporder,
                        datasetorder,
                        workerpoolorder,
                        requestorder4,
                        { from: user.address },
                    ),
                ];

                deals[1] = tools.extractEvents(
                    txsMined[0],
                    IexecInstance.address,
                    'OrdersMatched',
                )[0].args.dealid;
                deals[2] = tools.extractEvents(
                    txsMined[1],
                    IexecInstance.address,
                    'OrdersMatched',
                )[0].args.dealid;
                deals[3] = tools.extractEvents(
                    txsMined[2],
                    IexecInstance.address,
                    'OrdersMatched',
                )[0].args.dealid;
                deals[4] = tools.extractEvents(
                    txsMined[3],
                    IexecInstance.address,
                    'OrdersMatched',
                )[0].args.dealid;
            });
        });

        describe('[2] initialization', async () => {
            it('[TX] initialize', async () => {
                const txsMined = [
                    await IexecInstance.initialize(deals[1], 0, { from: scheduler.address }),
                    await IexecInstance.initialize(deals[2], 0, { from: scheduler.address }),
                    await IexecInstance.initialize(deals[3], 0, { from: scheduler.address }),
                    await IexecInstance.initialize(deals[4], 0, { from: scheduler.address }),
                ];

                tasks[1] = tools.extractEvents(
                    txsMined[0],
                    IexecInstance.address,
                    'TaskInitialize',
                )[0].args.taskid;
                tasks[2] = tools.extractEvents(
                    txsMined[1],
                    IexecInstance.address,
                    'TaskInitialize',
                )[0].args.taskid;
                tasks[3] = tools.extractEvents(
                    txsMined[2],
                    IexecInstance.address,
                    'TaskInitialize',
                )[0].args.taskid;
                tasks[4] = tools.extractEvents(
                    txsMined[3],
                    IexecInstance.address,
                    'TaskInitialize',
                )[0].args.taskid;
            });
        });

        async function sendContribution(worker, taskid, result, useenclave = true, callback) {
            const preauth = await scheduler.signPreAuthorization(taskid, worker.address);
            const [auth, secret] = useenclave
                ? await broker.signAuthorization(preauth)
                : [preauth, null];
            const results = await worker.run(auth, secret, result, callback);

            return IexecInstance.contribute(
                auth.taskid, // task (authorization)
                results.hash, // common    (result)
                results.seal, // unique    (result)
                auth.enclave, // address   (enclave)
                results.sign, // signature (enclave)
                auth.sign, // signature (authorization)
                { from: worker.address },
            );
        }

        describe('[3] contribute', async () => {
            it('[TX] contribute', async () => {
                await sendContribution(
                    worker1,
                    tasks[1],
                    'aResult 1',
                    false,
                    web3.utils.utf8ToHex('callback-1'),
                );
                await sendContribution(
                    worker1,
                    tasks[2],
                    'aResult 2',
                    false,
                    web3.utils.utf8ToHex('callback-2'),
                );
                await sendContribution(
                    worker1,
                    tasks[3],
                    'aResult 3',
                    false,
                    web3.utils.utf8ToHex('callback-3'),
                );
                await sendContribution(
                    worker1,
                    tasks[4],
                    'aResult 4',
                    false,
                    web3.utils.utf8ToHex('callback-4'),
                );
            });
        });

        describe('[4] reveal', async () => {
            it('[TX] reveal', async () => {
                await IexecInstance.reveal(
                    tasks[1],
                    odbtools.utils.hashByteResult(
                        tasks[1],
                        web3.utils.soliditySha3({
                            t: 'bytes',
                            v: web3.utils.utf8ToHex('callback-1'),
                        }),
                    ).digest,
                    { from: worker1.address },
                );
                await IexecInstance.reveal(
                    tasks[2],
                    odbtools.utils.hashByteResult(
                        tasks[2],
                        web3.utils.soliditySha3({
                            t: 'bytes',
                            v: web3.utils.utf8ToHex('callback-2'),
                        }),
                    ).digest,
                    { from: worker1.address },
                );
                await IexecInstance.reveal(
                    tasks[3],
                    odbtools.utils.hashByteResult(
                        tasks[3],
                        web3.utils.soliditySha3({
                            t: 'bytes',
                            v: web3.utils.utf8ToHex('callback-3'),
                        }),
                    ).digest,
                    { from: worker1.address },
                );
                await IexecInstance.reveal(
                    tasks[4],
                    odbtools.utils.hashByteResult(
                        tasks[4],
                        web3.utils.soliditySha3({
                            t: 'bytes',
                            v: web3.utils.utf8ToHex('callback-4'),
                        }),
                    ).digest,
                    { from: worker1.address },
                );
            });
        });

        describe('[5] finalization', async () => {
            describe('bad callback', async () => {
                it('[TX] no call', async () => {
                    await expectRevert.unspecified(
                        IexecInstance.finalize(
                            tasks[1],
                            web3.utils.utf8ToHex('aResult 1'),
                            web3.utils.utf8ToHex('wrong-callback'),
                            { from: scheduler.address },
                        ),
                    );
                });
            });

            describe('no callback', async () => {
                it('[TX] no call', async () => {
                    txMined = await IexecInstance.finalize(
                        tasks[1],
                        web3.utils.utf8ToHex('aResult 1'),
                        web3.utils.utf8ToHex('callback-1'),
                        { from: scheduler.address },
                    );

                    events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
                    assert.equal(events[0].args.taskid, tasks[1], 'check taskid');
                    assert.equal(
                        events[0].args.results,
                        web3.utils.utf8ToHex('aResult 1'),
                        'check consensus (results)',
                    );
                });
            });

            describe('invalid callback', async () => {
                it("[TX] doesn't revert", async () => {
                    txMined = await IexecInstance.finalize(
                        tasks[2],
                        web3.utils.utf8ToHex('aResult 2'),
                        web3.utils.utf8ToHex('callback-2'),
                        { from: scheduler.address },
                    );

                    events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
                    assert.equal(events[0].args.taskid, tasks[2], 'check taskid');
                    assert.equal(
                        events[0].args.results,
                        web3.utils.utf8ToHex('aResult 2'),
                        'check consensus (results)',
                    );
                });
            });

            describe('valid callback', async () => {
                it('[TX] call', async () => {
                    assert.equal(
                        await TestClientInstance.store(tasks[3]),
                        null,
                        'Error in test client: store empty',
                    );

                    txMined = await IexecInstance.finalize(
                        tasks[3],
                        web3.utils.utf8ToHex('aResult 3'),
                        web3.utils.utf8ToHex('callback-3'),
                        { from: scheduler.address },
                    );

                    events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
                    assert.equal(events[0].args.taskid, tasks[3], 'check taskid');
                    assert.equal(
                        events[0].args.results,
                        web3.utils.utf8ToHex('aResult 3'),
                        'check consensus (results)',
                    );
                });

                it('check', async () => {
                    assert.equal(
                        await TestClientInstance.store(tasks[3]),
                        web3.utils.utf8ToHex('callback-3'),
                        'Error in test client: dataset not stored',
                    );
                    // fails under coverage because of additional cost for instrumentation
                    // assert.equal(await TestClientInstance.gstore(tasks[3]), await IexecInstance.callbackgas()-343);
                });
            });

            describe('callback EOA', async () => {
                it("[TX] doesn't revert", async () => {
                    txMined = await IexecInstance.finalize(
                        tasks[4],
                        web3.utils.utf8ToHex('aResult 4'),
                        web3.utils.utf8ToHex('callback-4'),
                        { from: scheduler.address },
                    );

                    events = tools.extractEvents(txMined, IexecInstance.address, 'TaskFinalize');
                    assert.equal(events[0].args.taskid, tasks[4], 'check taskid');
                    assert.equal(
                        events[0].args.results,
                        web3.utils.utf8ToHex('aResult 4'),
                        'check consensus (results)',
                    );
                });
            });
        });
    });
});
