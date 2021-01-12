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

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

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

	it("[Genesis] Workerpool configuration", async () => {
		await WorkerpoolInstance.changePolicy(35, 5, { from: scheduler.address });
	});

	matchOrders = async (appextra, datasetextra, workerpoolextra, userextra) => {
		_apporder = {
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    constants.NULL.ADDRESS,
			workerpoolrestrict: constants.NULL.ADDRESS,
			requesterrestrict:  constants.NULL.ADDRESS,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		_datasetorder = {
			dataset:            DatasetInstance.address,
			datasetprice:       1,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			apprestrict:        constants.NULL.ADDRESS,
			workerpoolrestrict: constants.NULL.ADDRESS,
			requesterrestrict:  constants.NULL.ADDRESS,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		_workerpoolorder = {
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   25,
			volume:            1000,
			tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:          4,
			trust:             1000,
			apprestrict:       constants.NULL.ADDRESS,
			datasetrestrict:   constants.NULL.ADDRESS,
			requesterrestrict: constants.NULL.ADDRESS,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		};
		_requestorder = {
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         constants.NULL.ADDRESS,
			workerpoolmaxprice: 25,
			volume:             1,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:           4,
			trust:              1000,
			requester:          user.address,
			beneficiary:        user.address,
			callback:           constants.NULL.ADDRESS,
			params:             "<parameters>",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		for (key in appextra       ) _apporder[key]        = appextra[key];
		for (key in datasetextra   ) _datasetorder[key]    = datasetextra[key];
		for (key in workerpoolextra) _workerpoolorder[key] = workerpoolextra[key];
		for (key in userextra      ) _requestorder[key]    = userextra[key];
		await appProvider.signAppOrder(_apporder);
		await datasetProvider.signDatasetOrder(_datasetorder);
		await scheduler.signWorkerpoolOrder(_workerpoolorder);
		await user.signRequestOrder(_requestorder);
		return IexecInstance.matchOrders(_apporder, _datasetorder, _workerpoolorder, _requestorder, { from: user.address });
	};

	it("[Match - app-dataset-workerpool-user]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{},
		);

		deals = await odbtools.utils.requestToDeal(IexecInstance, odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: "bytes32", v: odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder) }, { t: "uint256", v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider.address       );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       DatasetInstance.address   );
		assert.equal  (       deal.dataset.owner,         datasetProvider.address   );
		assert.equal  (Number(deal.dataset.price),        1                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler.address         );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user.address              );
		assert.equal  (       deal.beneficiary,           user.address              );
		assert.equal  (       deal.callback,              constants.NULL.ADDRESS    );
		assert.equal  (       deal.params,                "<parameters>"            );
		assert.isAbove(Number(deal.startTime),            0                         );
		assert.equal  (Number(deal.botFirst),             0                         );
		assert.equal  (Number(deal.botSize),              1                         );
		assert.equal  (Number(deal.workerStake),          8                         ); // 8 = floor(25*.3)
		assert.equal  (Number(deal.schedulerRewardRatio), 5                         );
	});

	it("[Match - app-workerpool-user]", async () => {
		await matchOrders(
			{},
			constants.NULL.DATAORDER,
			{},
			{ dataset: constants.NULL.ADDRESS },
		);

		deals = await odbtools.utils.requestToDeal(IexecInstance, odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: "bytes32", v: odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder) }, { t: "uint256", v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider.address       );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       constants.NULL.ADDRESS    );
		assert.equal  (       deal.dataset.owner,         constants.NULL.ADDRESS    );
		assert.equal  (Number(deal.dataset.price),        0                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler.address         );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user.address              );
		assert.equal  (       deal.beneficiary,           user.address              );
		assert.equal  (       deal.callback,              constants.NULL.ADDRESS    );
		assert.equal  (       deal.params,                "<parameters>"            );
		assert.isAbove(Number(deal.startTime),            0                         );
		assert.equal  (Number(deal.botFirst),             0                         );
		assert.equal  (Number(deal.botSize),              1                         );
		assert.equal  (Number(deal.workerStake),          8                         ); // 8 = floor(25*.3)
		assert.equal  (Number(deal.schedulerRewardRatio), 5                         );
	});

	it("[Match - app-dataset-workerpool-user BOT]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{ volume: 10 },
		);

		deals = await odbtools.utils.requestToDeal(IexecInstance, odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: "bytes32", v: odbtools.utils.hashRequestOrder(ERC712_domain, _requestorder) }, { t: "uint256", v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider.address       );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       DatasetInstance.address   );
		assert.equal  (       deal.dataset.owner,         datasetProvider.address   );
		assert.equal  (Number(deal.dataset.price),        1                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler.address         );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user.address              );
		assert.equal  (       deal.beneficiary,           user.address              );
		assert.equal  (       deal.callback,              constants.NULL.ADDRESS    );
		assert.equal  (       deal.params,                "<parameters>"            );
		assert.isAbove(Number(deal.startTime),            0                         );
		assert.equal  (Number(deal.botFirst),             0                         );
		assert.equal  (Number(deal.botSize),              10                        );
		assert.equal  (Number(deal.workerStake),          8                         ); // 8 = floor(25*.3)
		assert.equal  (Number(deal.schedulerRewardRatio), 5                         );
	});

	it("[Match - Error - category]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ category: 5 },
		));
	});

	it("[Match - Error - trust]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ trust: 100 },
			{},
		));
	});

	it("[Match - Error - appprice]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ appprice: 1000 },
			{},
			{},
			{},
		));
	});

	it("[Match - Error - datasetprice]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ datasetprice: 1000 },
			{},
			{},
		));
	});

	it("[Match - Error - workerpoolprice]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ workerpoolprice: 1000 },
			{},
		));
	});

	it("[Match - Error - apptag]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ tag: "0x0000000000000000000000000000000000000000000000000000000000000001" },
			{},
			{},
			{},
		));
	});

	it("[Match - Error - datasettag]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ tag: "0x0000000000000000000000000000000000000000000000000000000000000001" },
			{},
			{},
		));
	});

	it("[Match - Ok - workerpooltag]", async () => {
		await matchOrders(
			{},
			{},
			{ tag: "0x0000000000000000000000000000000000000000000000000000000000000001" },
			{},
		);
	});

	it("[Match - Error - usertag]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ tag: "0x0000000000000000000000000000000000000000000000000000000000000001" },
		));
	});

	it("[Match - Error - requested app]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ app: user.address },
		));
	});

	it("[Match - Error - requested dataset]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ dataset: user.address },
		));
	});

	it("[Match - Error - workerpoolrequest]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ workerpool: user.address },
		));
	});

	it("[Match - Error - app-datasetrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ datasetrestrict: user.address },
			{},
			{},
			{},
		));
	});
	it("[Match - Ok - app-datasetrestrict]", async () => {
		await matchOrders(
			{ datasetrestrict: DatasetInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - app-workerpoolrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ workerpoolrestrict: user.address },
			{},
			{},
			{},
		));
	});
	it("[Match - Ok - app-workerpoolrestrict]", async () => {
		await matchOrders(
			{ workerpoolrestrict: WorkerpoolInstance.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - app-requesterrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ requesterrestrict: iexecAdmin.address },
			{},
			{},
			{},
		));
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		await matchOrders(
			{ requesterrestrict: user.address },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - dataset-apprestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ apprestrict: user.address },
			{},
			{},
		));
	});
	it("[Match - Ok - dataset-apprestrict]", async () => {
		await matchOrders(
			{},
			{ apprestrict: AppInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - app-workerpoolrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ workerpoolrestrict: user.address },
			{},
			{},
		));
	});
	it("[Match - Ok - app-workerpoolrestrict]", async () => {
		await matchOrders(
			{},
			{ workerpoolrestrict: WorkerpoolInstance.address },
			{},
			{},
		);
	});

	it("[Match - Error - app-requesterrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ requesterrestrict: iexecAdmin.address },
			{},
			{},
		));
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		await matchOrders(
			{},
			{ requesterrestrict: user.address },
			{},
			{},
		);
	});

	it("[Match - Error - workerpool-apprestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ apprestrict: user.address },
			{},
		));
	});
	it("[Match - Ok - workerpool-apprestrict]", async () => {
		await matchOrders(
			{},
			{},
			{ apprestrict: AppInstance.address },
			{},
		);
	});

	it("[Match - Error - workerpool-datasetrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ datasetrestrict: user.address },
			{},
		));
	});
	it("[Match - Ok - workerpool-datasetrestrict]", async () => {
		await matchOrders(
			{},
			{},
			{ datasetrestrict: DatasetInstance.address },
			{},
		);
	});

	it("[Match - Error - workerpool-requesterrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ requesterrestrict: iexecAdmin.address },
			{},
		));
	});
	it("[Match - Ok - workerpool-requesterrestrict]", async () => {
		await matchOrders(
			{},
			{},
			{ requesterrestrict: user.address },
			{},
		);
	});

	it("[Match - Error - volume null]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ volume: 0},
		));
	});

});
