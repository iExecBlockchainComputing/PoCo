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
	 *                                TEST: App                                *
	 ***************************************************************************/
	describe("apporder", async () => {
		it("valid operation - sign", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order:     apporder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider.address });
		});

		it("invalid operation", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order:     apporder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageAppOrder(apporderoperation, { from: appProvider.address });
		});

		it("invalid operation", async () => {
			const { apporder, hash } = await generateAppOrder();
			const apporderoperation = {
				order:     apporder,
				operation: 0xFF,
				sign:      constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageAppOrder(apporderoperation, { from: appProvider.address }));
		});
	});

	/***************************************************************************
	 *                              TEST: Dataset                              *
	 ***************************************************************************/
	describe("datasetorder", async () => {
		it("valid operation - sign", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order:     datasetorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider.address });
		});

		it("invalid operation", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order:     datasetorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider.address });
		});

		it("invalid operation", async () => {
			const { datasetorder, hash } = await generateDatasetOrder();
			const datasetorderoperation = {
				order:     datasetorder,
				operation: 0xFF,
				sign:      constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageDatasetOrder(datasetorderoperation, { from: datasetProvider.address }));
		});
	});

	/***************************************************************************
	 *                            TEST: Workerpool                             *
	 ***************************************************************************/
	describe("workerpoolorder", async () => {
		it("valid operation - sign", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler.address });
		});

		it("invalid operation", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order:     workerpoolorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler.address });
		});

		it("invalid operation", async () => {
			const { workerpoolorder, hash } = await generateWorkerpoolOrder();
			const workerpoolorderoperation = {
				order:     workerpoolorder,
				operation: 0xFF,
				sign:      constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageWorkerpoolOrder(workerpoolorderoperation, { from: scheduler.address }));
		});
	});

	/***************************************************************************
	 *                              TEST: Request                              *
	 ***************************************************************************/
	describe("requestorder", async () => {
		it("valid operation - sign", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order:     requestorder,
				operation: constants.OrderOperationEnum.SIGN,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user.address });
		});

		it("invalid operation", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order:     requestorder,
				operation: constants.OrderOperationEnum.CLOSE,
				sign:      constants.NULL.SIGNATURE
			};

			await IexecInstance.manageRequestOrder(requestorderoperation, { from: user.address });
		});

		it("invalid operation", async () => {
			const { requestorder, hash } = await generateRequestOrder();
			const requestorderoperation = {
				order:     requestorder,
				operation: 0xFF,
				sign:      constants.NULL.SIGNATURE
			};

			await expectRevert.unspecified(IexecInstance.manageRequestOrder(requestorderoperation, { from: user.address }));
		});
	});

});
