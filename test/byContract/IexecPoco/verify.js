/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

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

const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract("Poco", async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = null;
	let appProvider     = null;
	let datasetProvider = null;
	let scheduler       = null;
	let worker1         = null;
	let worker2         = null;
	let worker3         = null;
	let worker4         = null;
	let worker5         = null;
	let user            = null;

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
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.at(await IexecInstance.token());

		broker          = new odbtools.Broker    (IexecInstance);
		iexecAdmin      = new odbtools.iExecAgent(IexecInstance, accounts[0]);
		appProvider     = new odbtools.iExecAgent(IexecInstance, accounts[1]);
		datasetProvider = new odbtools.iExecAgent(IexecInstance, accounts[2]);
		scheduler       = new odbtools.Scheduler (IexecInstance, accounts[3]);
		worker1         = new odbtools.Worker    (IexecInstance, accounts[4]);
		worker2         = new odbtools.Worker    (IexecInstance, accounts[5]);
		worker3         = new odbtools.Worker    (IexecInstance, accounts[6]);
		worker4         = new odbtools.Worker    (IexecInstance, accounts[7]);
		worker5         = new odbtools.Worker    (IexecInstance, accounts[8]);
		user            = new odbtools.iExecAgent(IexecInstance, accounts[9]);
		await broker.initialize();
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("check signature mechanism", async () => {
		entry = { msg: web3.utils.randomHex(32) };
		await iexecAdmin.signMessage(entry, entry.msg);
		entry.hash = web3.eth.accounts.hashMessage(entry.msg);

		assert.equal  (await IexecInstance.viewPresigned                (entry.hash),            constants.NULL.ADDRESS                                         );
		assert.isFalse(await IexecInstance.verifyPresignature           (iexecAdmin.address,     entry.hash,                                                   ));
		assert.isTrue (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               entry.sign,                         ));
		assert.isTrue (await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               tools.compactSignature(entry.sign), ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(user.address,           entry.hash,               entry.sign,                         ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(constants.NULL.ADDRESS, entry.hash,               entry.sign,                         ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     web3.utils.randomHex(32), entry.sign,                         ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     constants.NULL.BYTES32,   entry.sign,                         ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               web3.utils.randomHex(64)            ));
		assert.isFalse(await IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               web3.utils.randomHex(64)+"1b"       ));
		await expectRevert(  IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               web3.utils.randomHex(64)+"1a"       ), "invalid-signature-v");
		await expectRevert(  IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,     entry.hash,               constants.NULL.SIGNATURE            ), "invalid-signature-format");
	});


	/***************************************************************************
	 *                             TEST: creation                              *
	 ***************************************************************************/
	it("[Genesis] App Creation", async () => {
		txMined = await AppRegistryInstance.createApp(
			appProvider.address,
			"R Clifford Attractors",
			"DOCKER",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			"0x",
			{ from: appProvider.address }
		);
		events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
		AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));
	});

	it("[Genesis] Dataset Creation", async () => {
		txMined = await DatasetRegistryInstance.createDataset(
			datasetProvider.address,
			"Pi",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			{ from: datasetProvider.address }
		);
		events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
		DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));
	});

	it("[Genesis] Workerpool Creation", async () => {
		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler.address,
			"A test workerpool",
			{ from: scheduler.address }
		);
		events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
		WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));
	});

	/***************************************************************************
	 *                             TEST: App hash                             *
	 ***************************************************************************/
	it("check app hash", async () => {
		apporder = await appProvider.signAppOrder({
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user.address,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});
		apporder_hash = odbtools.utils.hashAppOrder(ERC712_domain, apporder);

		assert.isTrue (await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, apporder                                                                                                                                                                                                                                                                           ), apporder.sign                        ));
		assert.isTrue (await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, apporder                                                                                                                                                                                                                                                                           ), tools.compactSignature(apporder.sign)));
		assert.isTrue (await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: constants.NULL.ADDRESS, appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: 0,                 volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: 0xFFFFFF,        tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: "0x1",        datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: constants.NULL.ADDRESS,   workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: constants.NULL.ADDRESS,      requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,     salt: apporder.salt            }), apporder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: web3.utils.randomHex(32) }), apporder.sign                        ));
		await expectRevert(  IexecInstance.verifySignature(appProvider.address, odbtools.utils.hashAppOrder(ERC712_domain, { app: apporder.app,           appprice: apporder.appprice, volume: apporder.volume, tag: apporder.tag, datasetrestrict: apporder.datasetrestrict, workerpoolrestrict: apporder.workerpoolrestrict, requesterrestrict: apporder.requesterrestrict, salt: apporder.salt            }), constants.NULL.SIGNATURE             ), "invalid-signature-format");
	});

	/***************************************************************************
	 *                             TEST: Dataset hash                             *
	 ***************************************************************************/
	it("check dataset hash", async () => {
		datasetorder = await datasetProvider.signDatasetOrder({
			dataset:            DatasetInstance.address,
			datasetprice:       3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			apprestrict:        AppInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user.address,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});
		datasetorder_hash = odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder);

		assert.isTrue (await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder                                                                                                                                                                                                                                                                                                   ), datasetorder.sign                        ));
		assert.isTrue (await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder                                                                                                                                                                                                                                                                                                   ), tools.compactSignature(datasetorder.sign)));
		assert.isTrue (await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: constants.NULL.ADDRESS, datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: 0,                         volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: 0xFFFFFF,            tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: "0x1",            apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: constants.NULL.ADDRESS,   workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: constants.NULL.ADDRESS,          requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: constants.NULL.ADDRESS,         salt: datasetorder.salt        }), datasetorder.sign                        ));
		assert.isFalse(await IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: web3.utils.randomHex(32) }), datasetorder.sign                        ));
		await expectRevert(  IexecInstance.verifySignature(datasetProvider.address, odbtools.utils.hashDatasetOrder(ERC712_domain, { dataset: datasetorder.dataset,   datasetprice: datasetorder.datasetprice, volume: datasetorder.volume, tag: datasetorder.tag, apprestrict: datasetorder.apprestrict, workerpoolrestrict: datasetorder.workerpoolrestrict, requesterrestrict: datasetorder.requesterrestrict, salt: datasetorder.salt        }), constants.NULL.SIGNATURE                 ), "invalid-signature-format");
	});

	/***************************************************************************
	 *                             TEST: Workerpool hash                             *
	 ***************************************************************************/
	it("check workerpool hash", async () => {
		workerpoolorder = await scheduler.signWorkerpoolOrder({
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            3,
			tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:          4,
			trust:             1000,
			apprestrict:       AppInstance.address,
			datasetrestrict:   DatasetInstance.address,
			requesterrestrict: user.address,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		});
		workerpoolorder_hash = odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder);

		assert.isTrue (await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder), workerpoolorder.sign));
		assert.isTrue (await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder), tools.compactSignature(workerpoolorder.sign)));
		assert.isTrue (await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: constants.NULL.ADDRESS,     workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: 0,                               volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: 0xFFFFFF,               category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: 5,                        trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: "0x1",               apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: constants.NULL.ADDRESS,      datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: constants.NULL.ADDRESS,          requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: constants.NULL.ADDRESS,            salt: workerpoolorder.salt     }), workerpoolorder.sign    ));
		assert.isFalse(await IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: web3.utils.randomHex(32) }), workerpoolorder.sign    ));
		await expectRevert(  IexecInstance.verifySignature(scheduler.address, odbtools.utils.hashWorkerpoolOrder(ERC712_domain, { workerpool: workerpoolorder.workerpool, workerpoolprice: workerpoolorder.workerpoolprice, volume: workerpoolorder.volume, category: workerpoolorder.category, trust: workerpoolorder.trust, tag: workerpoolorder.tag, apprestrict: workerpoolorder.apprestrict, datasetrestrict: workerpoolorder.datasetrestrict, requesterrestrict: workerpoolorder.requesterrestrict, salt: workerpoolorder.salt     }), constants.NULL.SIGNATURE), "invalid-signature-format");
	});

	/***************************************************************************
	 *                           TEST: Request hash                            *
	 ***************************************************************************/
	it("check request hash", async () => {
		requestorder = await user.signRequestOrder({
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
			requester:          user.address,
			beneficiary:        user.address,
			callback:           constants.NULL.ADDRESS,
			params:             "app params",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});
		requestorder_hash = odbtools.utils.hashRequestOrder(ERC712_domain, requestorder);

		assert.isTrue (await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, requestorder), requestorder.sign));
		assert.isTrue (await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, requestorder), tools.compactSignature(requestorder.sign)));
		assert.isTrue (await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: constants.NULL.ADDRESS, appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: 1000,                     dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: constants.NULL.ADDRESS, datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: 1000,                         workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: constants.NULL.ADDRESS,  workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: 1000,                            volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: 0xFFFFFF,            category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: 3,                     trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: 0,                  tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: "0x1",            requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: constants.NULL.ADDRESS, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: constants.NULL.ADDRESS,   callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: user.address,          params: requestorder.params, salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: "wrong params",      salt: requestorder.salt        }), requestorder.sign       ));
		assert.isFalse(await IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: web3.utils.randomHex(32) }), requestorder.sign       ));
		await expectRevert(  IexecInstance.verifySignature(user.address, odbtools.utils.hashRequestOrder(ERC712_domain, { app: requestorder.app,       appmaxprice: requestorder.appmaxprice, dataset: requestorder.dataset,   datasetmaxprice: requestorder.datasetmaxprice, workerpool: requestorder.workerpool, workerpoolmaxprice: requestorder.workerpoolmaxprice, volume: requestorder.volume, category: requestorder.category, trust: requestorder.trust, tag: requestorder.tag, requester: requestorder.requester, beneficiary: requestorder.beneficiary, callback: requestorder.callback, params: requestorder.params, salt: requestorder.salt        }), constants.NULL.SIGNATURE), "invalid-signature-format");
	});

});
