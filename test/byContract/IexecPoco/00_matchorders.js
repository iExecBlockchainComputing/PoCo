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
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();

		odbtools.setup(await IexecInstance.domain());
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

	it("[Genesis] Workerpool configuration", async () => {
		txMined = await WorkerpoolInstance.changePolicy(35, 5, { from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	matchOrders = (appextra, datasetextra, workerpoolextra, userextra) => {
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
			requester:          user,
			beneficiary:        user,
			callback:           constants.NULL.ADDRESS,
			params:             "<parameters>",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		};
		for (key in appextra       ) _apporder[key]        = appextra[key];
		for (key in datasetextra   ) _datasetorder[key]    = datasetextra[key];
		for (key in workerpoolextra) _workerpoolorder[key] = workerpoolextra[key];
		for (key in userextra      ) _requestorder[key]       = userextra[key];
		odbtools.signAppOrder       (_apporder,        wallets.addressToPrivate(appProvider    ));
		odbtools.signDatasetOrder   (_datasetorder,    wallets.addressToPrivate(datasetProvider));
		odbtools.signWorkerpoolOrder(_workerpoolorder, wallets.addressToPrivate(scheduler      ));
		odbtools.signRequestOrder   (_requestorder,    wallets.addressToPrivate(user           ));
		return IexecInstance.matchOrders(_apporder, _datasetorder, _workerpoolorder, _requestorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
	};



	it("[Match - app-dataset-workerpool-user]", async () => {
		await matchOrders(
			{},
			{},
			{},
			{},
		);

		deals = await odbtools.requestToDeal(IexecInstance, odbtools.RequestOrderTypedStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderTypedStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider               );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       DatasetInstance.address   );
		assert.equal  (       deal.dataset.owner,         datasetProvider           );
		assert.equal  (Number(deal.dataset.price),        1                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler                 );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user                      );
		assert.equal  (       deal.beneficiary,           user                      );
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

		deals = await odbtools.requestToDeal(IexecInstance, odbtools.RequestOrderTypedStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderTypedStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider               );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       constants.NULL.ADDRESS    );
		assert.equal  (       deal.dataset.owner,         constants.NULL.ADDRESS    );
		assert.equal  (Number(deal.dataset.price),        0                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler                 );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user                      );
		assert.equal  (       deal.beneficiary,           user                      );
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

		deals = await odbtools.requestToDeal(IexecInstance, odbtools.RequestOrderTypedStructHash(_requestorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.RequestOrderTypedStructHash(_requestorder) }, { t: 'uint256', v: 0 }), "check dealid");

		deal = await IexecInstance.viewDeal(deals[0]);
		assert.equal  (       deal.app.pointer,           AppInstance.address       );
		assert.equal  (       deal.app.owner,             appProvider               );
		assert.equal  (Number(deal.app.price),            3                         );
		assert.equal  (       deal.dataset.pointer,       DatasetInstance.address   );
		assert.equal  (       deal.dataset.owner,         datasetProvider           );
		assert.equal  (Number(deal.dataset.price),        1                         );
		assert.equal  (       deal.workerpool.pointer,    WorkerpoolInstance.address);
		assert.equal  (       deal.workerpool.owner,      scheduler                 );
		assert.equal  (Number(deal.workerpool.price),     25                        );
		assert.equal  (Number(deal.trust),                1000                      );
		assert.equal  (Number(deal.category),             4                         );
		assert.equal  (Number(deal.tag),                  0x0                       );
		assert.equal  (       deal.requester,             user                      );
		assert.equal  (       deal.beneficiary,           user                      );
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
			{ app: user },
		));
	});

	it("[Match - Error - requested dataset]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ dataset: user},
		));
	});

	it("[Match - Error - workerpoolrequest]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{},
			{ workerpool: user },
		));
	});

	it("[Match - Error - app-datasetrestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{ datasetrestrict: user },
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
			{ workerpoolrestrict: user },
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
			{ requesterrestrict: iexecAdmin },
			{},
			{},
			{},
		));
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		await matchOrders(
			{ requesterrestrict: user },
			{},
			{},
			{},
		);
	});

	it("[Match - Error - dataset-apprestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{ apprestrict: user },
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
			{ workerpoolrestrict: user },
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
			{ requesterrestrict: iexecAdmin },
			{},
			{},
		));
	});
	it("[Match - Ok - app-requesterrestrict]", async () => {
		await matchOrders(
			{},
			{ requesterrestrict: user },
			{},
			{},
		);
	});

	it("[Match - Error - workerpool-apprestrict]", async () => {
		await expectRevert.unspecified(matchOrders(
			{},
			{},
			{ apprestrict: user },
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
			{ datasetrestrict: user },
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
			{ requesterrestrict: iexecAdmin },
			{},
		));
	});
	it("[Match - Ok - workerpool-requesterrestrict]", async () => {
		await matchOrders(
			{},
			{},
			{ requesterrestrict: user },
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
