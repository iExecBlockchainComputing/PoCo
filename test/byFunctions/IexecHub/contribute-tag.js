var RLC          = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Relay        = artifacts.require("./Relay.sol");
var Broker       = artifacts.require("./Broker.sol");

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

const wallets   = require('../../wallets');

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
	var RelayInstance        = null;
	var BrokerInstance       = null;

	var DappInstance = null;
	var DataInstance = null;
	var PoolInstance = null;

	var dapporder  = null;
	var dataorder  = null;
	var poolorder1 = null;
	var poolorder2 = null;
	var userorder  = null;

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var RelayInstanceEthers      = null;
	var BrokerInstanceEthers     = null;

	var deals = {}
	var tasks = {};

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
		RelayInstance        = await Relay.deployed();
		BrokerInstance       = await Broker.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,           jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerkInstance.abi, jsonRpcProvider);
		RelayInstanceEthers      = new ethers.Contract(RelayInstance.address,      RelayInstance.abi,      jsonRpcProvider);
		BrokerInstanceEthers     = new ethers.Contract(BrokerInstance.address,     BrokerInstance.abi,     jsonRpcProvider);

		/**
		 * Token distribution
		 */
		assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");
		txsMined = await Promise.all([
			RLCInstance.transfer(dappProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(dataProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolScheduler, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker1,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker2,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker3,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker4,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,          1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(dappProvider),
			RLCInstance.balanceOf(dataProvider),
			RLCInstance.balanceOf(poolScheduler),
			RLCInstance.balanceOf(poolWorker1),
			RLCInstance.balanceOf(poolWorker2),
			RLCInstance.balanceOf(poolWorker3),
			RLCInstance.balanceOf(poolWorker4),
			RLCInstance.balanceOf(user)
		]);
		assert.equal(balances[0], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[1], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[2], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[3], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[4], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[5], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[6], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[7], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		txsMined = await Promise.all([
			IexecClerkInstance.deposit(100000, { from: poolScheduler }),
			IexecClerkInstance.deposit(100000, { from: poolWorker1   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker2   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker3   }),
			IexecClerkInstance.deposit(100000, { from: poolWorker4   }),
			IexecClerkInstance.deposit(100000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);

		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);

		txMined = await PoolRegistryInstance.createPool(poolScheduler, "A test workerpool", /* lock*/ 10, /* minimum stake*/ 10, /* minimum score*/ 10, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);

		txMined = await PoolInstance.changePoolPolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, /* minimum stake */ 100, /* minimum score */ 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Workers
		txsMined = await Promise.all([
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker1 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker2 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker3 }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		// Orders
		dapporder = odbtools.signDappOrder(
			{
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				tag:          0x0,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dappProvider)
		);
		dataorder = odbtools.signDataOrder(
			{
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		poolorder_offset = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    15,
				volume:       1,
				tag:          0x1,
				category:     4,
				trust:        1000,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		poolorder = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       1000,
				tag:          0x1,
				category:     4,
				trust:        1000,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		userorder = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       10,
				tag:          0x1,
				category:     4,
				trust:        1000,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);

		// Market
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).matchOrders(dapporder, dataorder, poolorder_offset, userorder, { gasLimit: constants.AMOUNT_GAS_PROVIDED });
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).matchOrders(dapporder, dataorder, poolorder,        userorder, { gasLimit: constants.AMOUNT_GAS_PROVIDED });

		// Deals
		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(userorder));
		assert.equal(deals[0], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder) }, { t: 'uint256', v: 0 }), "check dealid");
		assert.equal(deals[1], web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder) }, { t: 'uint256', v: 1 }), "check dealid");
	});

	it("[setup] Initialization", async () => {
		tasks[1] = extractEvents(await IexecHubInstance.initialize(deals[1], 1, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[2] = extractEvents(await IexecHubInstance.initialize(deals[1], 2, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[3] = web3.utils.soliditySha3({ t: 'bytes32', v: deals[1] }, { t: 'uint256', v: 3 });
		tasks[4] = extractEvents(await IexecHubInstance.initialize(deals[1], 4, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[5] = extractEvents(await IexecHubInstance.initialize(deals[1], 5, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[6] = extractEvents(await IexecHubInstance.initialize(deals[1], 6, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[7] = extractEvents(await IexecHubInstance.initialize(deals[1], 7, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[8] = extractEvents(await IexecHubInstance.initialize(deals[1], 8, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
	});

	function sendContribution(taskid, worker, results, authorization, enclave)
	{
		return IexecHubInstanceEthers
			.connect(jsonRpcProvider.getSigner(worker))
			.contribute(
				taskid,                                                 // task (authorization)
				results.hash,                              // common    (result)
				results.seal,                              // unique    (result)
				enclave,                                                // address   (enclave)
				results.sign ? results.sign : constants.NULL.SIGNATURE, // signature (enclave)
				authorization.sign,                                     // signature (authorization)
				{ gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
	}

	it("[2.1][TAG] Contribute - Error (missing sgx)", async () => {
		__taskid  = tasks[1];
		__worker  = poolWorker1;
		__enclave = constants.NULL.ADDRESS;
		__raw     = "true";

		try {
			await sendContribution(
				__taskid,
				__worker,
				odbtools.sealResult(__taskid, __raw, __worker),
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)),
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[2.2][TAG] Contribute - Correct (sgx)", async () => {
		__taskid  = tasks[2];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		await sendContribution(
			__taskid,
			__worker,
			(await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),             __enclave    )),
			(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)),
			__enclave
		);
		// No return from etherjs
		// assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		// events = extractEvents(txMined, IexecHubInstance.address, "ConsensusContribute");
		// assert.equal(events[0].args.taskid,     __taskid,                                               "check taskid"    );
		// assert.equal(events[0].args.worker,     __worker,                                               "check worker"    );
		// assert.equal(events[0].args.resultHash, odbtools.hashResult(__taskid, __raw).constibution.hash, "check resultHash");
	});

	it("[2.3][TAG] Contribute - Error (unset)", async () => {
		__taskid  = tasks[3];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		try {
			await sendContribution(
				__taskid,
				__worker,
				(await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),             __enclave    )),
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)),
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[2.4][TAG] Contribute - Error (duplicate)", async () => {
		__taskid  = tasks[4];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		results       = (await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),           __enclave    )),
		authorization = await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler);
		// First ok
		await sendContribution(
			__taskid,
			__worker,
			results,
			authorization,
			__enclave
		);
		// Second error
		try {
			await sendContribution(
				__taskid,
				__worker,
				results,
				authorization,
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[2.5][TAG] Contribute - Error (authorization)", async () => {
		__taskid  = tasks[5];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		try {
			await sendContribution(
				__taskid,
				__worker,
				(await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),             __enclave)),
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, __worker )), // signature: scheduler → worker
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[2.6][TAG] Contribute - Error (subsctription)", async () => {
		__taskid  = tasks[6];
		__worker  = poolWorker4; // worker not assigned to the workerpool
		__enclave = sgxEnclave;
		__raw     = "true"

		try {
			await sendContribution(
				__taskid,
				__worker,
				(await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),             __enclave    )),
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)),
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("[2.7][TAG] Contribute - Error (enclave signature)", async () => {
		__taskid  = tasks[7];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		try {
			await sendContribution(
				__taskid,
				__worker,
				odbtools.sealResult(__taskid, __raw, __worker), // should be signed
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)), // signature: scheduler → worker
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

	it("clock fast forward", async () => {
		target = (await IexecHubInstanceEthers.viewTask(tasks[8])).consensusDeadline.toNumber();

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[2.8][TAG] Contribute - Late", async () => {
		__taskid  = tasks[8];
		__worker  = poolWorker1;
		__enclave = sgxEnclave;
		__raw     = "true"

		try {
			await sendContribution(
				__taskid,
				__worker,
				(await odbtools.signContribution (odbtools.sealResult(__taskid, __raw, __worker),             __enclave    )),
				(await odbtools.signAuthorization({ worker: __worker, taskid: __taskid, enclave: __enclave }, poolScheduler)), // signature: scheduler → worker
				__enclave
			);
			assert.fail("transaction should have reverted");
		} catch (error) {
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
	});

});
