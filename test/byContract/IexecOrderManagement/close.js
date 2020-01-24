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

		agentBroker    = new odbtools.MockBroker(IexecInstance);
		agentScheduler = new odbtools.MockScheduler(scheduler);
		await agentBroker.initialize();
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
	 *                            TEST: App cancel                            *
	 ***************************************************************************/
	describe("cancel apporder", async () => {
		it("unauthorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation,{ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
		});

		it("unauthorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = odbtools.signAppOrderOperation(
				ERC712_domain,
				{
					order: apporder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
		});

		it("authorized signature", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = odbtools.signAppOrderOperation(
				ERC712_domain,
				{
					order: apporder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(appProvider)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), apporder.volume, "Error in app order presign");
		});

		it("authorized sender", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in app order presign");
			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), apporder.volume, "Error in app order presign");
		});
	});

	/***************************************************************************
	 *                            TEST: Dataset cancel                            *
	 ***************************************************************************/
	describe("cancel datasetorder", async () => {
		it("unauthorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation,{ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
		});

		it("unauthorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = odbtools.signDatasetOrderOperation(
				ERC712_domain,
				{
					order: datasetorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
		});

		it("authorized signature", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = odbtools.signDatasetOrderOperation(
				ERC712_domain,
				{
					order: datasetorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(datasetProvider)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), datasetorder.volume, "Error in dataset order presign");
		});

		it("authorized sender", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in dataset order presign");
			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), datasetorder.volume, "Error in dataset order presign");
		});
	});

	/***************************************************************************
	 *                            TEST: Workerpool cancel                            *
	 ***************************************************************************/
	describe("cancel workerpoolorder", async () => {
		it("unauthorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation,{ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
		});

		it("unauthorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = odbtools.signWorkerpoolOrderOperation(
				ERC712_domain,
				{
					order: workerpoolorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
		});

		it("authorized signature", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = odbtools.signWorkerpoolOrderOperation(
				ERC712_domain,
				{
					order: workerpoolorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(scheduler)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), workerpoolorder.volume, "Error in workerpool order presign");
		});

		it("authorized sender", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in workerpool order presign");
			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), workerpoolorder.volume, "Error in workerpool order presign");
		});
	});

	/***************************************************************************
	 *                          TEST: Request cancel                           *
	 ***************************************************************************/
	describe("cancel requestorder", async () => {
		it("unauthorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation,{ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
		});

		it("unauthorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = odbtools.signRequestOrderOperation(
				ERC712_domain,
				{
					order: requestorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(iexecAdmin)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }));
			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
		});

		it("authorized signature", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = odbtools.signRequestOrderOperation(
				ERC712_domain,
				{
					order: requestorder,
					operation: constants.OrderOperationEnum.CLOSE,
					sign: constants.NULL.SIGNATURE
				},
				wallets.addressToPrivate(user)
			);

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), requestorder.volume, "Error in request order presign");
		});

		it("authorized sender", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			assert.equal(await IexecInstance.viewConsumed(hash), 0, "Error in request order presign");
			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.equal(await IexecInstance.viewConsumed(hash), requestorder.volume, "Error in request order presign");
		});
	});

});
