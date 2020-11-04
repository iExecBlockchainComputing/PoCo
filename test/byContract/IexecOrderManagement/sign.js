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

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('OrderManagement', async (accounts) => {

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
	 *                             TEST: deposit                              *
	 ***************************************************************************/
	it("[Genesis] deposit", async () => {
		switch (DEPLOYMENT.asset)
		{
			case "Native":
				await IexecInstance.deposit({ from: iexecAdmin.address, value: 10000000 * 10 ** 9 });
				break;

			case "Token":
				await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin.address });
				break;
		}
		await Promise.all([
			IexecInstance.transfer(scheduler.address, 1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker1.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker2.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker3.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker4.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker5.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(user.address,      1000, { from: iexecAdmin.address }),
		]);
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

	const generateAppOrder = () => {
		const apporder = {
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user.address,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.utils.hashAppOrder(ERC712_domain, apporder);
		return { apporder, hash };
	}

	const generateDatasetOrder = () => {
		const datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       1,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			apprestrict:        AppInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user.address,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.utils.hashDatasetOrder(ERC712_domain, datasetorder);
		return { datasetorder, hash };
	}

	const generateWorkerpoolOrder = () => {
		const workerpoolorder = {
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
			sign:              constants.NULL.SIGNATURE
		};
		const hash = odbtools.utils.hashWorkerpoolOrder(ERC712_domain, workerpoolorder);
		return { workerpoolorder, hash };
	}

	const generateRequestOrder = () => {
		const requestorder = {
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
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.utils.hashRequestOrder(ERC712_domain, requestorder);
		return { requestorder, hash };
	}

	/***************************************************************************
	 *                             TEST: App sign                             *
	 ***************************************************************************/
	describe("sign apporder", async () => {
		it("unauthorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order:     apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,              ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (appProvider.address, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, apporder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(appProvider.address, hash, apporder.sign));
		});

		it("unauthorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = await iexecAdmin.signAppOrderOperation({
				order:     apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,              ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (appProvider.address, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, apporder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(appProvider.address, hash, apporder.sign));
		});

		it("authorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = await appProvider.signAppOrderOperation({
				order:     apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin.address });
			assert.equal(await IexecInstance.viewPresigned(hash), appProvider.address, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,              ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (appProvider.address, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, apporder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (appProvider.address, hash, apporder.sign));
		});

		it("authorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order:     apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider.address });
			assert.equal(await IexecInstance.viewPresigned(hash), appProvider.address, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,              ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (appProvider.address, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, apporder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (appProvider.address, hash, apporder.sign));
		});
	});

	/***************************************************************************
	 *                             TEST: Dataset sign                             *
	 ***************************************************************************/
	describe("sign datasetorder", async () => {
		it("unauthorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order:     datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,      hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (datasetProvider.address, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,      hash, datasetorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(datasetProvider.address, hash, datasetorder.sign));
		});

		it("unauthorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = await iexecAdmin.signDatasetOrderOperation({
				order:     datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,      hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (datasetProvider.address, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,      hash, datasetorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(datasetProvider.address, hash, datasetorder.sign));
		});

		it("authorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = await datasetProvider.signDatasetOrderOperation({
				order:     datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin.address });
			assert.equal(await IexecInstance.viewPresigned(hash), datasetProvider.address, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,      hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (datasetProvider.address, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,      hash, datasetorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (datasetProvider.address, hash, datasetorder.sign));
		});

		it("authorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order:     datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider.address });
			assert.equal(await IexecInstance.viewPresigned(hash), datasetProvider.address, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,      hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (datasetProvider.address, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,      hash, datasetorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (datasetProvider.address, hash, datasetorder.sign));
		});
	});

	/***************************************************************************
	 *                             TEST: Workerpool sign                             *
	 ***************************************************************************/
	describe("sign workerpoolorder", async () => {
		it("unauthorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address, hash,                     ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (scheduler.address,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address, hash, workerpoolorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(scheduler.address,  hash, workerpoolorder.sign));
		});

		it("unauthorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = await iexecAdmin.signWorkerpoolOrderOperation({
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address, hash,                     ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (scheduler.address,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address, hash, workerpoolorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(scheduler.address,  hash, workerpoolorder.sign));
		});

		it("authorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = await scheduler.signWorkerpoolOrderOperation({
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin.address });
			assert.equal(await IexecInstance.viewPresigned(hash), scheduler.address, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address, hash,                     ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (scheduler.address,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address, hash, workerpoolorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (scheduler.address,  hash, workerpoolorder.sign));
		});

		it("authorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler.address });
			assert.equal(await IexecInstance.viewPresigned(hash), scheduler.address, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address, hash,                    ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (scheduler.address,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address, hash, workerpoolorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (scheduler.address,  hash, workerpoolorder.sign));
		});
	});

	/***************************************************************************
	 *                           TEST: Request sign                            *
	 ***************************************************************************/
	describe("sign requestorder", async () => {
		it("unauthorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order:     requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (user.address,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, requestorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(user.address,        hash, requestorder.sign));
		});

		it("unauthorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = await iexecAdmin.signRequestOrderOperation({
				order:     requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin.address }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (user.address,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, requestorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(user.address,        hash, requestorder.sign));
		});

		it("authorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = await user.signRequestOrderOperation({
				order:     requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			});

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin.address });
			assert.equal(await IexecInstance.viewPresigned(hash), user.address, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (user.address,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, requestorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (user.address,        hash, requestorder.sign));
		});

		it("authorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order:     requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user.address });
			assert.equal(await IexecInstance.viewPresigned(hash), user.address, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin.address,  hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (user.address,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin.address,  hash, requestorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (user.address,        hash, requestorder.sign));
		});
	});

	describe("matching presigned orders", async () => {
		it("match", async () => {
			const { apporder        } = await generateAppOrder();
			const { datasetorder    } = await generateDatasetOrder();
			const { workerpoolorder } = await generateWorkerpoolOrder();
			const { requestorder    } = await generateRequestOrder();

			await IexecInstance.manageAppOrder       ({ order: apporder,        operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: appProvider.address,    });
			await IexecInstance.manageDatasetOrder   ({ order: datasetorder,    operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: datasetProvider.address });
			await IexecInstance.manageWorkerpoolOrder({ order: workerpoolorder, operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: scheduler.address,      });
			await IexecInstance.manageRequestOrder   ({ order: requestorder,    operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: user.address,           });

			await IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user.address });
		});
	});

});
