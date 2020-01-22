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

contract('OrderManagement', async (accounts) => {

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

		ERC712_domain              = await IexecInstance.domain();
	});

	/***************************************************************************
	 *                             TEST: deposit                              *
	 ***************************************************************************/
	it("[Genesis] deposit", async () => {
		switch (DEPLOYMENT.asset)
		{
			case "Native":
				await IexecInstance.deposit({ from: iexecAdmin, value: 10000000 * 10 ** 9, gas: constants.AMOUNT_GAS_PROVIDED });
				break;

			case "Token":
				await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				break;
		}
		await Promise.all([
			IexecInstance.transfer(scheduler, 1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker1,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker2,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker3,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker4,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(worker5,   1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			IexecInstance.transfer(user,      1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
		]);
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

	const generateAppOrder = () => {
		const apporder = {
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    DatasetInstance.address,
			workerpoolrestrict: WorkerpoolInstance.address,
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.hashAppOrder(ERC712_domain, apporder);
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
			requesterrestrict:  user,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.hashDatasetOrder(ERC712_domain, datasetorder);
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
			requesterrestrict: user,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE
		};
		const hash = odbtools.hashWorkerpoolOrder(ERC712_domain, workerpoolorder);
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
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "app params",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE
		};
		const hash = odbtools.hashRequestOrder(ERC712_domain, requestorder);
		return { requestorder, hash };
	}

	/***************************************************************************
	 *                             TEST: App sign                             *
	 ***************************************************************************/
	describe("sign apporder", async () => {
		it("unauthorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,              ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (appProvider, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, apporder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(appProvider, hash, apporder.sign));
		});

		it("unauthorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = odbtools.signAppOrderOperation(
				ERC712_domain,
				{
					order: apporder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,              ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (appProvider, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, apporder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(appProvider, hash, apporder.sign));
		});

		it("authorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = odbtools.signAppOrderOperation(
				ERC712_domain,
				{
					order: apporder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(appProvider)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), appProvider, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,              ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (appProvider, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, apporder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (appProvider, hash, apporder.sign));
		});

		it("authorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), appProvider, "Error in app order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,              ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (appProvider, hash,              ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, apporder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (appProvider, hash, apporder.sign));
		});
	});

	/***************************************************************************
	 *                             TEST: Dataset sign                             *
	 ***************************************************************************/
	describe("sign datasetorder", async () => {
		it("unauthorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,      hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (datasetProvider, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,      hash, datasetorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(datasetProvider, hash, datasetorder.sign));
		});

		it("unauthorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = odbtools.signDatasetOrderOperation(
				ERC712_domain,
				{
					order: datasetorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,      hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (datasetProvider, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,      hash, datasetorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(datasetProvider, hash, datasetorder.sign));
		});

		it("authorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = odbtools.signDatasetOrderOperation(
				ERC712_domain,
				{
					order: datasetorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(datasetProvider)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), datasetProvider, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,      hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (datasetProvider, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,      hash, datasetorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (datasetProvider, hash, datasetorder.sign));
		});

		it("authorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), datasetProvider, "Error in dataset order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,      hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (datasetProvider, hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,      hash, datasetorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (datasetProvider, hash, datasetorder.sign));
		});
	});

	/***************************************************************************
	 *                             TEST: Workerpool sign                             *
	 ***************************************************************************/
	describe("sign workerpoolorder", async () => {
		it("unauthorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin, hash,                     ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (scheduler,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin, hash, workerpoolorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(scheduler,  hash, workerpoolorder.sign));
		});

		it("unauthorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = odbtools.signWorkerpoolOrderOperation(
				ERC712_domain,
				{
					order: workerpoolorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin, hash,                     ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (scheduler,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin, hash, workerpoolorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(scheduler,  hash, workerpoolorder.sign));
		});

		it("authorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = odbtools.signWorkerpoolOrderOperation(
				ERC712_domain,
				{
					order: workerpoolorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(scheduler)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), scheduler, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin, hash,                     ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (scheduler,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin, hash, workerpoolorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (scheduler,  hash, workerpoolorder.sign));
		});

		it("authorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), scheduler, "Error in workerpool order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin, hash,                    ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (scheduler,  hash,                     ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin, hash, workerpoolorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (scheduler,  hash, workerpoolorder.sign));
		});
	});

	/***************************************************************************
	 *                           TEST: Request sign                            *
	 ***************************************************************************/
	describe("sign requestorder", async () => {
		it("unauthorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (user,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, requestorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(user,        hash, requestorder.sign));
		});

		it("unauthorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = odbtools.signRequestOrderOperation(
				ERC712_domain,
				{
					order: requestorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,                  ));
			assert.isFalse(await IexecInstance.verifyPresignature                     (user,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, requestorder.sign));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(user,        hash, requestorder.sign));
		});

		it("authorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = odbtools.signRequestOrderOperation(
				ERC712_domain,
				{
					order: requestorder,
					operation: constants.OrderOperationEnum.SIGN,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(user)
			);

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), user, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (user,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, requestorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (user,        hash, requestorder.sign));
		});

		it("authorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewPresigned(hash), constants.NULL.ADDRESS, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewPresigned(hash), user, "Error in request order presign");
			assert.isFalse(await IexecInstance.verifyPresignature                     (iexecAdmin,  hash,                  ));
			assert.isTrue (await IexecInstance.verifyPresignature                     (user,        hash,                  ));
			await expectRevert.unspecified(IexecInstance.verifyPresignatureOrSignature(iexecAdmin,  hash, requestorder.sign));
			assert.isTrue (await IexecInstance.verifyPresignatureOrSignature          (user,        hash, requestorder.sign));
		});
	});

	describe("matching presigned orders", async () => {
		it("match", async () => {
			const { apporder        } = await generateAppOrder();
			const { datasetorder    } = await generateDatasetOrder();
			const { workerpoolorder } = await generateWorkerpoolOrder();
			const { requestorder    } = await generateRequestOrder();

			await IexecInstance.manageAppOrder       ({ order: apporder,        operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: appProvider,     gas: constants.AMOUNT_GAS_PROVIDED });
			await IexecInstance.manageDatasetOrder   ({ order: datasetorder,    operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
			await IexecInstance.manageWorkerpoolOrder({ order: workerpoolorder, operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: scheduler,       gas: constants.AMOUNT_GAS_PROVIDED });
			await IexecInstance.manageRequestOrder   ({ order: requestorder,    operation: constants.OrderOperationEnum.SIGN, sign: constants.NULL.SIGNATURE }, { from: user,            gas: constants.AMOUNT_GAS_PROVIDED });

			await IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder, requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		});
	});

});
