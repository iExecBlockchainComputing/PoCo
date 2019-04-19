var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");

const { shouldFail } = require('openzeppelin-test-helpers');
const   multiaddr    = require('multiaddr');
const   constants    = require("../../../utils/constants");
const   odbtools     = require('../../../utils/odb-tools');
const   wallets      = require('../../../utils/wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecClerk', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let sgxEnclave      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let worker5         = accounts[8];
	let user            = accounts[9];

	var RLCInstance                = null;
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance                = await RLC.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecHubInstance           = await IexecHub.deployed();
		IexecClerkInstance         = await IexecClerk.deployed();
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("check signature mechanism", async () => {
		entry = { hash: web3.utils.randomHex(32) };
		odbtools.signStruct(entry, entry.hash, wallets.addressToPrivate(iexecAdmin));

		assert.isFalse      (await IexecClerkInstance.viewPresigned(entry.hash),                                                                       "Error with the validation of signatures");
		assert.isTrue       (await IexecClerkInstance.verifySignature(iexecAdmin,             entry.hash,               entry.sign,               {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user,                   entry.hash,               entry.sign,               {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(constants.NULL.ADDRESS, entry.hash,               entry.sign,               {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(iexecAdmin,             web3.utils.randomHex(32), entry.sign,               {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(iexecAdmin,             constants.NULL.BYTES32,   entry.sign,               {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(iexecAdmin,             entry.hash,               web3.utils.randomHex(65), {}), "Error with the validation of signatures");
		await shouldFail.reverting(IexecClerkInstance.verifySignature(iexecAdmin,             entry.hash,               constants.NULL.SIGNATURE, {}), "Error with the validation of signatures");
	});


	/***************************************************************************
	 *                             TEST: creation                              *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(
			appProvider,
			"R Clifford Attractors",
			"DOCKER",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			"0x",
			{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance = await App.at(events[0].args.app);
	});

	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(
			datasetProvider,
			"Pi",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance = await Dataset.at(events[0].args.dataset);
	});

	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
		WorkerpoolInstance = await Workerpool.at(events[0].args.workerpool);
	});

	/***************************************************************************
	 *                             TEST: App hash                             *
	 ***************************************************************************/
	it("check app hash", async () => {
		apporder = {
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		apporder_hash = odbtools.AppOrderTypedStructHash(apporder);
		odbtools.signAppOrder(apporder, wallets.addressToPrivate(appProvider));

		assert.isTrue(await IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash(apporder), apporder.sign, {}), "Error with the validation of the apporder signature");
		assert.isTrue(await IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: constants.NULL.ADDRESS, appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: 0,                 volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: 0xFFFFFF,        tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: "0x1",        datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: constants.NULL.ADDRESS,   workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: constants.NULL.ADDRESS,      requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,     salt: apporder.salt            }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: web3.utils.randomHex(32) }), apporder.sign,            {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                             TEST: Dataset hash                             *
	 ***************************************************************************/
	it("check dataset hash", async () => {
		datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			apprestrict:        AppInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		datasetorder_hash = odbtools.DatasetOrderTypedStructHash(datasetorder);
		odbtools.signDatasetOrder(datasetorder, wallets.addressToPrivate(datasetProvider));

		assert.isTrue(await IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash(datasetorder), datasetorder.sign, {}), "Error with the validation of the datasetorder signature");
		assert.isTrue(await IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: constants.NULL.ADDRESS, datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: 0,                         volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: 0xFFFFFF,            tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: "0x1",            apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: constants.NULL.ADDRESS,   workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: constants.NULL.ADDRESS,          requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,         salt: datasetorder.salt        }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: web3.utils.randomHex(32) }), datasetorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                             TEST: Workerpool hash                             *
	 ***************************************************************************/
	it("check workerpool hash", async () => {
		workerpoolorder = {
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            3,
			tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:          4,
			trust:             1000,
			apprestrict:       AppInstance.address,
			datasetrestrict:   DatasetInstance.address,
			requesterrestrict: user,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		};
		workerpoolorder_hash = odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder);
		odbtools.signWorkerpoolOrder(workerpoolorder, wallets.addressToPrivate(scheduler));

		assert.isTrue(await IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder), workerpoolorder.sign, {}), "Error with the validation of the workerpoolorder signature");
		assert.isTrue(await IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: constants.NULL.ADDRESS,     workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: 0,                               volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: 0xFFFFFF,               category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: 5,                        trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: "0x1",               apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: constants.NULL.ADDRESS,      datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: constants.NULL.ADDRESS,          requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: constants.NULL.ADDRESS,            salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: web3.utils.randomHex(32) }), workerpoolorder.sign,     {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                           TEST: Request hash                            *
	 ***************************************************************************/
	it("check request hash", async () => {
		requestorder = {
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         WorkerpoolInstance.address,
			workerpoolmaxprice: 25,
			volume:             1,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:           4,
			trust:              1000,
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "app params",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		requestorder_hash = odbtools.RequestOrderTypedStructHash(requestorder);
		odbtools.signRequestOrder(requestorder, wallets.addressToPrivate(user));

		assert.isTrue(await IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash(requestorder), requestorder.sign, {}), "Error with the validation of the requestorder signature");
		assert.isTrue(await IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: constants.NULL.ADDRESS, appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: 1000,                     dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: constants.NULL.ADDRESS, datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: 1000,                         workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: constants.NULL.ADDRESS,  workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: 1000,                            volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: 0xFFFFFF,            category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: 3,                     trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: 0,                  tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: "0x1",            requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: constants.NULL.ADDRESS, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: constants.NULL.ADDRESS,   callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: user,                  params: requestorder.params, salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: "wrong params",      salt: requestorder.salt        }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: web3.utils.randomHex(32) }), requestorder.sign,        {}));
		await shouldFail.reverting(IexecClerkInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), constants.NULL.SIGNATURE, {}));
	});

});
