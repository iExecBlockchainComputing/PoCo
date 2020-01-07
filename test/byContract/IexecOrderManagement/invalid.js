// Config
var DEPLOYMENT = require("../../../config/deployment.json")
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

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
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

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecInstance.address,
		});
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
		const hash = odbtools.AppOrderTypedStructHash(apporder);
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
		const hash = odbtools.DatasetOrderTypedStructHash(datasetorder);
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
		const hash = odbtools.WorkerpoolOrderTypedStructHash(workerpoolorder);
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
		const hash = odbtools.RequestOrderTypedStructHash(requestorder);
		return { requestorder, hash };
	}

	/***************************************************************************
	 *                                TEST: App                                *
	 ***************************************************************************/
	describe("apporder", async () => {
		it("valid operation - sign", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order: apporder,
				operation: 0xFF,
				sign: constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }));
		});
	});

	/***************************************************************************
	 *                              TEST: Dataset                              *
	 ***************************************************************************/
	describe("datasetorder", async () => {
		it("valid operation - sign", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order: datasetorder,
				operation: 0xFF,
				sign: constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }));
		});
	});

	/***************************************************************************
	 *                            TEST: Workerpool                             *
	 ***************************************************************************/
	describe("workerpoolorder", async () => {
		it("valid operation - sign", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order: workerpoolorder,
				operation: 0xFF,
				sign: constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }));
		});
	});

	/***************************************************************************
	 *                              TEST: Request                              *
	 ***************************************************************************/
	describe("requestorder", async () => {
		it("valid operation - sign", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign: constants.NULL.SIGNATURE
			};

			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user, gas: constants.AMOUNT_GAS_PROVIDED });
		});

		it("invalid operation", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order: requestorder,
				operation: 0xFF,
				sign: constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: user, gas: constants.AMOUNT_GAS_PROVIDED }));
		});
	});

});
