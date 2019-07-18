var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require("IexecInterface");
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { shouldFail } = require('openzeppelin-test-helpers');
const   multiaddr    = require('multiaddr');
const   constants    = require("../../../utils/constants");
const   odbtools     = require('../../../utils/odb-tools');
const   wallets      = require('../../../utils/wallets');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('Registries', async (accounts) => {

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

	var AppInstances        = {};
	var DatasetInstances    = {};
	var WorkerpoolInstances = {};

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance                = await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("App Creation", async () => {
		for (i=1; i<5; ++i)
		{
			const code = new web3.eth.Contract(App.abi).deploy({ data: App.bytecode, arguments: [] }).encodeABI();
			const salt = web3.utils.soliditySha3(
				{ t: 'string',  v: "App #"+i                                  },
				{ t: 'string',  v: "DOCKER"                                   },
				{ t: 'bytes',   v: constants.MULTIADDR_BYTES                  },
				{ t: 'bytes32', v: web3.utils.keccak256("Content of app #"+i) },
				{ t: 'bytes',   v: "0x1234"                                   },
			);
			const predictedAddress = web3.utils.toChecksumAddress(web3.utils.soliditySha3(
				{ t: 'bytes1',  v: '0xff'                      },
				{ t: 'address', v: AppRegistryInstance.address },
				{ t: 'bytes32', v: salt                        },
				{ t: 'bytes32', v: web3.utils.keccak256(code)  },
			).slice(26));

			txMined = await AppRegistryInstance.createApp(
				appProvider,
				"App #"+i,
				"DOCKER",
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of app #"+i),
				"0x1234",
				{ from: appProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
			assert.equal(events[0].args.app,      predictedAddress);
			assert.equal(events[0].args.appOwner, appProvider);

			AppInstances[i] = await App.at(predictedAddress);
			assert.equal (await AppInstances[i].owner(),                       appProvider                               );
			assert.equal (await AppInstances[i].m_appName(),                   "App #"+i                                 );
			assert.equal (await AppInstances[i].m_appType(),                   "DOCKER"                                  );
			assert.equal (await AppInstances[i].m_appMultiaddr(),              constants.MULTIADDR_BYTES                 );
			assert.equal (await AppInstances[i].m_appChecksum(),               web3.utils.keccak256("Content of app #"+i));
			assert.equal (await AppInstances[i].m_appMREnclave(),              "0x1234"                                  );
			assert.equal (await AppRegistryInstance.viewCount(appProvider),    i                                         );
			assert.equal (await AppRegistryInstance.viewEntry(appProvider, i), AppInstances[i].address                   );
			assert.isTrue(await AppRegistryInstance.isRegistered(AppInstances[i].address)                                );
		}
	});

	/***************************************************************************
	 *                  TEST: Dataset creation (by datasetProvider)                  *
	 ***************************************************************************/
	it("Dataset Creation", async () => {
		for (i=1; i<5; ++i)
		{
			const code = new web3.eth.Contract(Dataset.abi).deploy({ data: Dataset.bytecode, arguments: [] }).encodeABI();
			const salt = web3.utils.soliditySha3(
				{ t: 'string',  v: "Dataset #"+i                                  },
				{ t: 'bytes',   v: constants.MULTIADDR_BYTES                      },
				{ t: 'bytes32', v: web3.utils.keccak256("Content of dataset #"+i) },
			);
			const predictedAddress = web3.utils.toChecksumAddress(web3.utils.soliditySha3(
				{ t: 'bytes1',  v: '0xff'                          },
				{ t: 'address', v: DatasetRegistryInstance.address },
				{ t: 'bytes32', v: salt                            },
				{ t: 'bytes32', v: web3.utils.keccak256(code)      },
			).slice(26));

			txMined = await DatasetRegistryInstance.createDataset(
				datasetProvider,
				"Dataset #"+i,
				constants.MULTIADDR_BYTES,
				web3.utils.keccak256("Content of dataset #"+i),
				{ from: datasetProvider, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
			assert.equal(events[0].args.dataset,      predictedAddress);
			assert.equal(events[0].args.datasetOwner, datasetProvider);

			DatasetInstances[i] = await Dataset.at(predictedAddress);
			assert.equal (await DatasetInstances[i].owner(),                           datasetProvider                               );
			assert.equal (await DatasetInstances[i].m_datasetName(),                   "Dataset #"+i                                 );
			assert.equal (await DatasetInstances[i].m_datasetMultiaddr(),              constants.MULTIADDR_BYTES                     );
			assert.equal (await DatasetInstances[i].m_datasetChecksum(),               web3.utils.keccak256("Content of dataset #"+i));
			assert.equal (await DatasetRegistryInstance.viewCount(datasetProvider),    i                                             );
			assert.equal (await DatasetRegistryInstance.viewEntry(datasetProvider, i), DatasetInstances[i].address                   );
			assert.isTrue(await DatasetRegistryInstance.isRegistered(DatasetInstances[i].address)                                    );
		}
	});

	/***************************************************************************
	 *                 TEST: Workerpool creation (by scheduler)                  *
	 ***************************************************************************/
	it("Workerpool Creation", async () => {
		for (i=1; i<5; ++i)
		{
			const code = new web3.eth.Contract(Workerpool.abi).deploy({ data: Workerpool.bytecode, arguments: [] }).encodeABI();
			const salt = web3.utils.soliditySha3(
				{ t: 'string', v: "Workerpool #"+i },
			);
			const predictedAddress = web3.utils.toChecksumAddress(web3.utils.soliditySha3(
				{ t: 'bytes1',  v: '0xff'                             },
				{ t: 'address', v: WorkerpoolRegistryInstance.address },
				{ t: 'bytes32', v: salt                               },
				{ t: 'bytes32', v: web3.utils.keccak256(code)         },
			).slice(26));

			txMined = await WorkerpoolRegistryInstance.createWorkerpool(
				scheduler,
				"Workerpool #"+i,
				{ from: scheduler, gas: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
			assert.equal(events[0].args.workerpool,      predictedAddress);
			assert.equal(events[0].args.workerpoolOwner, scheduler, "Erroneous Workerpool owner");

			WorkerpoolInstances[i] = await Workerpool.at(predictedAddress);
			assert.equal (await WorkerpoolInstances[i].owner(),                                          scheduler,                      "Erroneous Workerpool owner"                   );
			assert.equal (await WorkerpoolInstances[i].m_workerpoolDescription(),                        "Workerpool #"+i,               "Erroneous Workerpool description"             );
			assert.equal (await WorkerpoolInstances[i].m_workerStakeRatioPolicy(),                       30,                             "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolInstances[i].m_schedulerRewardRatioPolicy(),                   1,                              "Erroneous Workerpool params"                  );
			assert.equal (await WorkerpoolRegistryInstance.viewCount(scheduler),                         i,                              "scheduler must have 1 more workerpool now");
			assert.equal (await WorkerpoolRegistryInstance.viewEntry(scheduler, i),                      WorkerpoolInstances[i].address, "check workerpoolAddress"                      );
			assert.isTrue(await WorkerpoolRegistryInstance.isRegistered(WorkerpoolInstances[i].address),                                 "check workerpool registration"                );
		}
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("Check internals", async () => {
		assert.equal(DatasetRegistryInstance.contract.insert,    undefined, "expected insert internal");
		assert.equal(AppRegistryInstance.contract.insert,        undefined, "expected insert internal");
		assert.equal(WorkerpoolRegistryInstance.contract.insert, undefined, "expected insert internal");
	});

});
