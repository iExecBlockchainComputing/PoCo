// Config
var DEPLOYMENT         = require("../../../config/config.json").chains.default;
// Artefacts
var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const multiaddr = require('multiaddr');
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Poco', async (accounts) => {

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
	var IexecInstance              = null;
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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		odbtools.setup(await IexecInstance.domain());
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("check signature mechanism", async () => {
		entry = { hash: web3.utils.randomHex(32) };
		odbtools.signStruct(entry, entry.hash, wallets.addressToPrivate(iexecAdmin));

		assert.equal            (await IexecInstance.viewPresigned                (entry.hash),            constants.NULL.ADDRESS                                  );
		assert.isFalse          (await IexecInstance.verifyPresignature           (iexecAdmin,             entry.hash,                                            ));
		assert.isTrue           (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               entry.sign,                  ));
		assert.isTrue           (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               entry.sign,                  ));
		assert.isFalse          (await IexecInstance.verifyPresignatureOrSignature(user,                   entry.hash,               entry.sign,                  ));
		assert.isFalse          (await IexecInstance.verifyPresignatureOrSignature(constants.NULL.ADDRESS, entry.hash,               entry.sign,                  ));
		assert.isFalse          (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             web3.utils.randomHex(32), entry.sign,                  ));
		assert.isFalse          (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             constants.NULL.BYTES32,   entry.sign,                  ));
		assert.isFalse          (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               web3.utils.randomHex(64)+'1b'));
		await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               web3.utils.randomHex(64)+'1a'));
		await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               web3.utils.randomHex(64)     ));
		await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,             entry.hash,               constants.NULL.SIGNATURE     ));
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
		events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
		AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));
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
		events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
		DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));
	});

	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler,
			"A test workerpool",
			{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
		WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));
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

		assert.isTrue           (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash(apporder                                                                                                                                                                                                                                                                           ), apporder.sign           ));
		assert.isTrue           (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: constants.NULL.ADDRESS, appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: 0,                 volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: 0xFFFFFF,        tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: "0x1",        datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: constants.NULL.ADDRESS,   workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: constants.NULL.ADDRESS,      requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,     salt: apporder.salt            }), apporder.sign           ));
		assert.isFalse          (await IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: web3.utils.randomHex(32) }), apporder.sign           ));
		await expectRevert.unspecified(IexecInstance.verifySignature(appProvider, odbtools.AppOrderTypedStructHash({ app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), constants.NULL.SIGNATURE));
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

		assert.isTrue           (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash(datasetorder                                                                                                                                                                                                                                                                                                   ), datasetorder.sign       ));
		assert.isTrue           (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: constants.NULL.ADDRESS, datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: 0,                         volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: 0xFFFFFF,            tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: "0x1",            apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: constants.NULL.ADDRESS,   workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: constants.NULL.ADDRESS,          requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,         salt: datasetorder.salt        }), datasetorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: web3.utils.randomHex(32) }), datasetorder.sign       ));
		await expectRevert.unspecified(IexecInstance.verifySignature(datasetProvider, odbtools.DatasetOrderTypedStructHash({ dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), constants.NULL.SIGNATURE));
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

		assert.isTrue           (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder), workerpoolorder.sign));
		assert.isTrue           (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: constants.NULL.ADDRESS,     workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: 0,                               volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: 0xFFFFFF,               category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: 5,                        trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: "0x1",               apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: constants.NULL.ADDRESS,      datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: constants.NULL.ADDRESS,          requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: constants.NULL.ADDRESS,            salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse          (await IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: web3.utils.randomHex(32) }), workerpoolorder.sign    ));
		await expectRevert.unspecified(IexecInstance.verifySignature(scheduler, odbtools.WorkerpoolOrderTypedStructHash({ workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), constants.NULL.SIGNATURE));
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

		assert.isTrue           (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash(requestorder), requestorder.sign));
		assert.isTrue           (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: constants.NULL.ADDRESS, appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: 1000,                     dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: constants.NULL.ADDRESS, datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: 1000,                         workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: constants.NULL.ADDRESS,  workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: 1000,                            volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: 0xFFFFFF,            category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: 3,                     trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: 0,                  tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: "0x1",            requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: constants.NULL.ADDRESS, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: constants.NULL.ADDRESS,   callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: user,                  params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: "wrong params",      salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse          (await IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: web3.utils.randomHex(32) }), requestorder.sign       ));
		await expectRevert.unspecified(IexecInstance.verifySignature(user, odbtools.RequestOrderTypedStructHash({ app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), constants.NULL.SIGNATURE));
	});

});