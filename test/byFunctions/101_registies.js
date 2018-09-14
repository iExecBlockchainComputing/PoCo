var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Beacon       = artifacts.require("./Beacon.sol");
var Broker       = artifacts.require("./Broker.sol");

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("../constants");
const odbtools  = require('../../utils/odb-tools');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let poolWorker4   = accounts[7];
	let user          = accounts[8];
	let sgxEnclave    = accounts[9];

	var RLCInstance          = null;
	var IexecHubInstance     = null;
	var IexecClerkInstance   = null;
	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;
	var BeaconInstance       = null;
	var BrokerInstance       = null;

	var DappInstances = {};
	var DataInstances = {};
	var PoolInstances = {};

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance          = await RLC.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		BeaconInstance       = await Beacon.deployed();
		BrokerInstance       = await Broker.deployed();
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("Dapp Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await DappRegistryInstance.createDapp(dappProvider, "Dapp #"+i, constants.DAPP_PARAMS_EXAMPLE, { from: dappProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
			assert.equal(events[0].args.dappOwner,  dappProvider,                  "Erroneous Dapp owner" );
			assert.equal(events[0].args.dappName,   "Dapp #"+i,                    "Erroneous Dapp name"  );
			assert.equal(events[0].args.dappParams, constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");

			DappInstances[i] = await Dapp.at(events[0].args.dapp);
			assert.equal (await DappInstances[i].m_owner(),                                  dappProvider,                  "Erroneous Dapp owner"                  );
			assert.equal (await DappInstances[i].m_dappName(),                               "Dapp #"+i,                    "Erroneous Dapp name"                   );
			assert.equal (await DappInstances[i].m_dappParams(),                             constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params"                 );
			assert.equal (await DappRegistryInstance.viewCount(dappProvider),                i,                             "dappProvider must have 1 more dapp now");
			assert.equal (await DappRegistryInstance.viewEntry(dappProvider, i),             DappInstances[i].address,      "check dappAddress"                     );
			assert.isTrue(await DappRegistryInstance.isRegistered(DappInstances[i].address),                                "check dapp registration"               );
		}
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("Data Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await DataRegistryInstance.createData(dataProvider, "Data #"+i, "3.1415926535", { from: dataProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
			assert.equal(events[0].args.dataOwner,  dataProvider,   "Erroneous Data owner" );
			assert.equal(events[0].args.dataName,   "Data #"+i,     "Erroneous Data name"  );
			assert.equal(events[0].args.dataParams, "3.1415926535", "Erroneous Data params");

			DataInstances[i] = await Data.at(events[0].args.data);
			assert.equal (await DataInstances[i].m_owner(),                                  dataProvider,             "Erroneous Data owner"                  );
			assert.equal (await DataInstances[i].m_dataName(),                               "Data #"+i,               "Erroneous Data name"                   );
			assert.equal (await DataInstances[i].m_dataParams(),                             "3.1415926535",           "Erroneous Data params"                 );
			assert.equal (await DataRegistryInstance.viewCount(dataProvider),                i,                        "dataProvider must have 1 more data now");
			assert.equal (await DataRegistryInstance.viewEntry(dataProvider, i),             DataInstances[i].address, "check dataAddress"                     );
			assert.isTrue(await DataRegistryInstance.isRegistered(DataInstances[i].address),                           "check data registration"               );
		}
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("Pool Creation", async () => {
		for (i=1; i<5; ++i)
		{
			txMined = await PoolRegistryInstance.createPool(
				poolScheduler,
				"Pool #"+i,
				10, // lock
				10, // minimum stake
				10, // minimum score
				{ from: poolScheduler }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
			assert.equal(events[0].args.poolOwner,       poolScheduler,   "Erroneous Pool owner"      );
			assert.equal(events[0].args.poolDescription, "Pool #"+i,      "Erroneous Pool description");

			PoolInstances[i] = await Pool.at(events[0].args.pool);
			assert.equal (await PoolInstances[i].m_owner(),                                  poolScheduler,            "Erroneous Pool owner"                   );
			assert.equal (await PoolInstances[i].m_poolDescription(),                        "Pool #"+i,               "Erroneous Pool description"             );
			assert.equal (await PoolInstances[i].m_workerStakeRatioPolicy(),                 30,                       "Erroneous Pool params"                  );
			assert.equal (await PoolInstances[i].m_schedulerRewardRatioPolicy(),             1,                        "Erroneous Pool params"                  );
			assert.equal (await PoolInstances[i].m_subscriptionLockStakePolicy(),            10,                       "Erroneous Pool params"                  );
			assert.equal (await PoolInstances[i].m_subscriptionMinimumStakePolicy(),         10,                       "Erroneous Pool params"                  );
			assert.equal (await PoolInstances[i].m_subscriptionMinimumScorePolicy(),         10,                       "Erroneous Pool params"                  );
			assert.equal (await PoolRegistryInstance.viewCount(poolScheduler),               i,                        "poolScheduler must have 1 more pool now");
			assert.equal (await PoolRegistryInstance.viewEntry(poolScheduler, i),            PoolInstances[i].address, "check poolAddress"                      );
			assert.isTrue(await PoolRegistryInstance.isRegistered(PoolInstances[i].address),                           "check pool registration"                );
		}
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("Check internals", async () => {
		assert.equal(DataRegistryInstance.contract.insert, undefined, "expected insert internal");
		assert.equal(DappRegistryInstance.contract.insert, undefined, "expected insert internal");
		assert.equal(PoolRegistryInstance.contract.insert, undefined, "expected insert internal");
	});

});
