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
const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

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
			DappInstances[i] = await Dapp.new(
				dappProvider,
				"Dapp #"+i,
				constants.DAPP_PARAMS_EXAMPLE,
				constants.NULL.BYTES32,
				{ from: dappProvider }
			);
			assert.equal ( await DappInstances[i].m_owner(),      dappProvider,                  "Erroneous Dapp owner" );
			assert.equal ( await DappInstances[i].m_dappName(),   "Dapp #"+i,                    "Erroneous Dapp name"  );
			assert.equal ( await DappInstances[i].m_dappParams(), constants.DAPP_PARAMS_EXAMPLE, "Erroneous Dapp params");
			assert.equal ( await DappInstances[i].m_dappHash(),   constants.NULL.BYTES32,        "Erroneous Dapp hash"  );
		}
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("Data Creation", async () => {
		for (i=1; i<5; ++i)
		{
			DataInstances[i] = await Data.new(
				dataProvider,
				"Data #"+i,
				"3.1415926535",
				constants.NULL.BYTES32,
				{ from: dataProvider }
			);
			assert.equal ( await DataInstances[i].m_owner(),      dataProvider,           "Erroneous Data owner" );
			assert.equal ( await DataInstances[i].m_dataName(),   "Data #"+i,             "Erroneous Data name"  );
			assert.equal ( await DataInstances[i].m_dataParams(), "3.1415926535",         "Erroneous Data params");
			assert.equal ( await DataInstances[i].m_dataHash(),   constants.NULL.BYTES32, "Erroneous Data hash"  );
		}
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("Pool Creation", async () => {
		for (i=1; i<5; ++i)
		{
			PoolInstances[i] = await Pool.new(
				poolScheduler,
				"Pool #"+i,
				10, // lock
				10, // minimum stake
				10, // minimum score
				{ from: poolScheduler }
			);
			assert.equal ( await PoolInstances[i].m_owner(),                           poolScheduler, "Erroneous Pool owner"      );
			assert.equal ( await PoolInstances[i].m_poolDescription(),                 "Pool #"+i,    "Erroneous Pool description");
			assert.equal ((await PoolInstances[i].m_workerStakeRatioPolicy()),         30,            "Erroneous Pool params"     );
			assert.equal ((await PoolInstances[i].m_schedulerRewardRatioPolicy()),     1,             "Erroneous Pool params"     );
			assert.equal ((await PoolInstances[i].m_subscriptionLockStakePolicy()),    10,            "Erroneous Pool params"     );
			assert.equal ((await PoolInstances[i].m_subscriptionMinimumStakePolicy()), 10,            "Erroneous Pool params"     );
			assert.equal ((await PoolInstances[i].m_subscriptionMinimumScorePolicy()), 10,            "Erroneous Pool params"     );
		}
	});

	/***************************************************************************
	 *               TEST: Pool configuration (by poolScheduler)               *
	 ***************************************************************************/
	it("Pool Configuration - owner can configure", async () => {
		txMined = await PoolInstances[1].changePoolPolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, PoolInstances[1].address, "PoolPolicyUpdate");
		assert.equal(events[0].args.oldWorkerStakeRatioPolicy,         30,  "Erroneous oldWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.newWorkerStakeRatioPolicy,         35,  "Erroneous newWorkerStakeRatioPolicy"        );
		assert.equal(events[0].args.oldSchedulerRewardRatioPolicy,     1,   "Erroneous oldSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.newSchedulerRewardRatioPolicy,     5,   "Erroneous newSchedulerRewardRatioPolicy"    );
		assert.equal(events[0].args.oldSubscriptionMinimumStakePolicy, 10,  "Erroneous oldSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumStakePolicy, 100, "Erroneous newSubscriptionMinimumStakePolicy");
		assert.equal(events[0].args.oldSubscriptionMinimumScorePolicy, 10,  "Erroneous oldSubscriptionMinimumScorePolicy");
		assert.equal(events[0].args.newSubscriptionMinimumScorePolicy, 0,   "Erroneous newSubscriptionMinimumScorePolicy");

		assert.equal( await PoolInstances[1].m_owner(),                           poolScheduler, "Erroneous Pool owner"      );
		assert.equal( await PoolInstances[1].m_poolDescription(),                 "Pool #1",     "Erroneous Pool description");
		assert.equal((await PoolInstances[1].m_workerStakeRatioPolicy()),         35,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_schedulerRewardRatioPolicy()),     5,             "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionLockStakePolicy()),    10,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,           "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,             "Erroneous Pool params"     );
	});

	/***************************************************************************
	 *                   TEST: Pool configuration (by user)                    *
	 ***************************************************************************/
	it("Pool Configuration #2 - owner restriction apply", async () => {
		try
		{
			await PoolInstances[1].changePoolPolicy(
				0,
				0,
				0,
				0,
				{ from: user }
			);
			assert.fail("user should not be able to change policy");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("Returned error: VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal( await PoolInstances[1].m_owner(),                           poolScheduler, "Erroneous Pool owner"      );
		assert.equal( await PoolInstances[1].m_poolDescription(),                 "Pool #1",     "Erroneous Pool description");
		assert.equal((await PoolInstances[1].m_workerStakeRatioPolicy()),         35,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_schedulerRewardRatioPolicy()),     5,             "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionLockStakePolicy()),    10,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,           "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,             "Erroneous Pool params"     );
	});

	/***************************************************************************
	 *           TEST: Invalid pool configuration (by poolScheduler)           *
	 ***************************************************************************/
	it("Pool Configuration #3 - invalid configuration refused", async () => {
		try
		{
			await PoolInstances[1].changePoolPolicy(
				100, // worker stake ratio
				150, // scheduler reward ratio (should not be above 100%)
				0,   // minimum stake
				0,   // minimum score
				{ from: poolScheduler }
			);
			assert.fail("user should not be able to set invalid policy");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("Returned error: VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}

		assert.equal( await PoolInstances[1].m_owner(),                           poolScheduler, "Erroneous Pool owner"      );
		assert.equal( await PoolInstances[1].m_poolDescription(),                 "Pool #1",     "Erroneous Pool description");
		assert.equal((await PoolInstances[1].m_workerStakeRatioPolicy()),         35,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_schedulerRewardRatioPolicy()),     5,             "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionLockStakePolicy()),    10,            "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumStakePolicy()), 100,           "Erroneous Pool params"     );
		assert.equal((await PoolInstances[1].m_subscriptionMinimumScorePolicy()), 0,             "Erroneous Pool params"     );
	});

});
