var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
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

var TestClient   = artifacts.require("./TestClient.sol");

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("../../../constants");
const odbtools  = require('../../../../utils/odb-tools');

const wallets   = require('../../../wallets');

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

	var deals = {};
	var tasks = {};

	var TestClientInstance = null;

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

		TestClientInstance = await TestClient.new();
		TestClientInstance
			.GotResult()
			.on('data', event => console.log("GotResult:", event));

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
				data:         constants.NULL.ADDRESS,
				dataprice:    0,
				volume:       0,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         constants.NULL.ADDRESS,
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		poolorder = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       1000,
				tag:          0x0,
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

		userorder1 = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         constants.NULL.ADDRESS,
				datamaxprice: 0,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1,
				tag:          0x0,
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
		userorder2 = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         constants.NULL.ADDRESS,
				datamaxprice: 0,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1,
				tag:          0x0,
				category:     4,
				trust:        1000,
				requester:    user,
				beneficiary:  user,
				callback:     DappInstance.address,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);
		userorder3 = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         constants.NULL.ADDRESS,
				datamaxprice: 0,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       1,
				tag:          0x0,
				category:     4,
				trust:        1000,
				requester:    user,
				beneficiary:  user,
				callback:     TestClientInstance.address,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);

		// Market
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).matchOrders(dapporder, dataorder, poolorder, userorder1, { gasLimit: constants.AMOUNT_GAS_PROVIDED });
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).matchOrders(dapporder, dataorder, poolorder, userorder2, { gasLimit: constants.AMOUNT_GAS_PROVIDED });
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).matchOrders(dapporder, dataorder, poolorder, userorder3, { gasLimit: constants.AMOUNT_GAS_PROVIDED });

		// Deals
		deals[1] = web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder1) }, { t: 'uint256', v: 0 });
		deals[2] = web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder2) }, { t: 'uint256', v: 0 });
		deals[3] = web3.utils.soliditySha3({ t: 'bytes32', v: odbtools.UserOrderStructHash(userorder3) }, { t: 'uint256', v: 0 });
	});

	it("[setup] Initialization", async () => {
		tasks[1] = extractEvents(await IexecHubInstance.initialize(deals[1], 0, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[2] = extractEvents(await IexecHubInstance.initialize(deals[2], 0, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
		tasks[3] = extractEvents(await IexecHubInstance.initialize(deals[3], 0, { from: poolScheduler }), IexecHubInstance.address, "TaskInitialize")[0].args.taskid;
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

	it("[setup] Contribute", async () => {
		await sendContribution(
			tasks[1],
			poolWorker1,
			odbtools.sealResult(tasks[1], "true", poolWorker1),
			await odbtools.signAuthorization({ worker: poolWorker1, taskid: tasks[1], enclave: constants.NULL.ADDRESS }, poolScheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[2],
			poolWorker1,
			odbtools.sealResult(tasks[2], "true", poolWorker1),
			await odbtools.signAuthorization({ worker: poolWorker1, taskid: tasks[2], enclave: constants.NULL.ADDRESS }, poolScheduler),
			constants.NULL.ADDRESS
		);
		await sendContribution(
			tasks[3],
			poolWorker1,
			odbtools.sealResult(tasks[3], "true", poolWorker1),
			await odbtools.signAuthorization({ worker: poolWorker1, taskid: tasks[3], enclave: constants.NULL.ADDRESS }, poolScheduler),
			constants.NULL.ADDRESS
		);
	});

	it("[setup] Consensus", async () => {
		await IexecHubInstance.consensus(tasks[1], odbtools.hashResult(tasks[1], "true").hash, { from: poolScheduler });
		await IexecHubInstance.consensus(tasks[2], odbtools.hashResult(tasks[2], "true").hash, { from: poolScheduler });
		await IexecHubInstance.consensus(tasks[3], odbtools.hashResult(tasks[3], "true").hash, { from: poolScheduler });
	});

	it("[setup] Reveal", async () => {
		await IexecHubInstance.reveal(tasks[1], odbtools.hashResult(tasks[1], "true").digest, { from: poolWorker1 });
		await IexecHubInstance.reveal(tasks[2], odbtools.hashResult(tasks[2], "true").digest, { from: poolWorker1 });
		await IexecHubInstance.reveal(tasks[3], odbtools.hashResult(tasks[3], "true").digest, { from: poolWorker1 });
	});


	it("Finalize - No callback", async () => {
		txMined = await IexecHubInstance.finalize(tasks[1], web3.utils.utf8ToHex("aResult 1"), { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[1],                          "check taskid");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"), "check consensus (results)");
	});

	it("Finalize - Invalid callback", async () => {
		txMined = await IexecHubInstance.finalize(tasks[2], web3.utils.utf8ToHex("aResult 2"), { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[2],                          "check taskid");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"), "check consensus (results)");
	});

	it("Finalize - Valid callback", async () => {
		assert.equal(await TestClientInstance.store(tasks[3]), null, "Error in test client: store empty");

		txMined = await IexecHubInstance.finalize(tasks[3], web3.utils.utf8ToHex("aResult 3"), { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[3],                          "check taskid");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 3"), "check consensus (results)");

		assert.equal(await TestClientInstance.store(tasks[3]), web3.utils.utf8ToHex("aResult 3"), "Error in test client: data not stored");
	});

});
