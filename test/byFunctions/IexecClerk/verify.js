var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");
var Relay              = artifacts.require("./Relay.sol");
var Broker             = artifacts.require("./Broker.sol");

var IexecODBLibOrders = artifacts.require("./tools/IexecODBLibOrders.sol");

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

const wallets   = require('../../wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let user            = accounts[8];
	let sgxEnclave      = accounts[9];

	var RLCInstance                = null;
	var IexecHubInstance           = null;
	var IexecClerkInstance         = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;
	var RelayInstance              = null;
	var BrokerInstance             = null;

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
		RelayInstance              = await Relay.deployed();
		BrokerInstance             = await Broker.deployed();

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
		entry = { hash: web3.utils.soliditySha3({ t: 'bytes32', v: web3.utils.randomHex(32) }) };
		odbtools.signStruct(entry, entry.hash, wallets.addressToPrivate(iexecAdmin));

		assert.isFalse(await IexecClerkInstance.viewPresigned(entry.hash),                                                                                                                   "Error with the validation of signatures");
		assert.isTrue (await IexecClerkInstance.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(user,                   entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(constants.NULL.ADDRESS, entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             web3.utils.randomHex(32), { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             constants.NULL.BYTES32,   { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             entry.hash,               { v: 0,            r: entry.sign.r,             s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: web3.utils.randomHex(32), s: entry.sign.s             }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: web3.utils.randomHex(32) }, {}), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstance.verify(iexecAdmin,             entry.hash,               constants.NULL.SIGNATURE,                                                      {}), "Error with the validation of signatures");
	});


	/***************************************************************************
	 *                             TEST: creation                              *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(appProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: appProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
		AppInstance        = await App.at(events[0].args.app);
	});
	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(datasetProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: datasetProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
		DatasetInstance    = await Dataset.at(events[0].args.dataset);
	});
	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(scheduler, "A test workerpool", 10, 10, 10, { from: scheduler });
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
			tag:                0x0,
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		apporder_hash = odbtools.AppOrderStructHash(apporder);
		odbtools.signAppOrder(apporder, wallets.addressToPrivate(appProvider));

		assert.isTrue (await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash(apporder), apporder.sign, {}), "Error with the validation of the apporder signature");
		assert.isTrue (await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: constants.NULL.ADDRESS, appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: 0,                 volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: 0xFFFFFF,        tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: 0x1,          datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: constants.NULL.ADDRESS,   workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: constants.NULL.ADDRESS,      requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,     salt: apporder.salt            }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: web3.utils.randomHex(32) }), apporder.sign,            {}));
		assert.isFalse(await IexecClerkInstance.verify(appProvider, odbtools.AppOrderStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                             TEST: Dataset hash                             *
	 ***************************************************************************/
	it("check dataset hash", async () => {
		datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       3,
			volume:             1000,
			tag:                0x0,
			apprestrict:        AppInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		datasetorder_hash = odbtools.DatasetOrderStructHash(datasetorder);
		odbtools.signDatasetOrder(datasetorder, wallets.addressToPrivate(datasetProvider));

		assert.isTrue (await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash(datasetorder), datasetorder.sign, {}), "Error with the validation of the datasetorder signature");
		assert.isTrue (await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: constants.NULL.ADDRESS, datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: 0,                         volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: 0xFFFFFF,            tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: 0x1,              apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: constants.NULL.ADDRESS,   workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: constants.NULL.ADDRESS,          requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,         salt: datasetorder.salt        }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: web3.utils.randomHex(32) }), datasetorder.sign,        {}));
		assert.isFalse(await IexecClerkInstance.verify(datasetProvider, odbtools.DatasetOrderStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                             TEST: Workerpool hash                             *
	 ***************************************************************************/
	it("check workerpool hash", async () => {
		workerpoolorder = {
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            3,
			tag:               0x0,
			category:          4,
			trust:             1000,
			apprestrict:       AppInstance.address,
			datasetrestrict:   DatasetInstance.address,
			requesterrestrict: user,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		};
		workerpoolorder_hash = odbtools.WorkerpoolOrderStructHash(workerpoolorder);
		odbtools.signWorkerpoolOrder(workerpoolorder, wallets.addressToPrivate(scheduler));

		assert.isTrue (await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash(workerpoolorder), workerpoolorder.sign, {}), "Error with the validation of the workerpoolorder signature");
		assert.isTrue (await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: constants.NULL.ADDRESS,     workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: 0,                               volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: 0xFFFFFF,               category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: 5,                        trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: 1,                   apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: constants.NULL.ADDRESS,      datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: constants.NULL.ADDRESS,          requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: constants.NULL.ADDRESS,            salt: workerpoolorder.salt     }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: web3.utils.randomHex(32) }), workerpoolorder.sign,     {}));
		assert.isFalse(await IexecClerkInstance.verify(scheduler, odbtools.WorkerpoolOrderStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), constants.NULL.SIGNATURE, {}));
	});

	/***************************************************************************
	 *                             TEST: User hash                             *
	 ***************************************************************************/
	it("check user hash", async () => {
		userorder = {
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         WorkerpoolInstance.address,
			workerpoolmaxprice: 25,
			volume:             1,
			tag:                0x0,
			category:           4,
			trust:              1000,
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "app params",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		userorder_hash = odbtools.UserOrderStructHash(userorder);
		odbtools.signUserOrder(userorder, wallets.addressToPrivate(user));

		assert.isTrue (await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash(userorder), userorder.sign, {}), "Error with the validation of the userorder signature");
		assert.isTrue (await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: constants.NULL.ADDRESS, appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: 1000,                  dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: constants.NULL.ADDRESS, datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: 1000,                      workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: constants.NULL.ADDRESS, workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: 1000,                         volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: 0xFFFFFF,         category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: 3,                  trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: 0,               tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: 1,             requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: constants.NULL.ADDRESS, beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: constants.NULL.ADDRESS, callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: user,               params: userorder.params, salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: "wrong params",   salt: userorder.salt           }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: web3.utils.randomHex(32) }), userorder.sign,           {}));
		assert.isFalse(await IexecClerkInstance.verify(user, odbtools.UserOrderStructHash({ app: userorder.app,          appmaxprice: userorder.appmaxprice, dataset: userorder.dataset,      datasetmaxprice: userorder.datasetmaxprice, workerpool: userorder.workerpool,   workerpoolmaxprice: userorder.workerpoolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt           }), constants.NULL.SIGNATURE, {}));
	});

});
