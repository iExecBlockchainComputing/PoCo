var RLC          = artifacts.require("./rlc-token/RLC.sol");
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

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var RelayInstanceEthers      = null;
	var BrokerInstanceEthers     = null;

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

		/**
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,           jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerkInstance.abi, jsonRpcProvider);
		RelayInstanceEthers      = new ethers.Contract(RelayInstance.address,      RelayInstance.abi,      jsonRpcProvider);
		BrokerInstanceEthers     = new ethers.Contract(BrokerInstance.address,     BrokerInstance.abi,     jsonRpcProvider);
	});

	/***************************************************************************
	 *                             TEST: creation                              *
	 ***************************************************************************/
	it("[Genesis] Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);
	});

	it("[Genesis] Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);
	});

	it("[Genesis] Pool Creation", async () => {
		txMined = await PoolRegistryInstance.createPool(poolScheduler, "A test workerpool", 10, 10, 10, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);
	});

	it("[Genesis] create orders", async () => {
		dapporder = {
			dapp:         DappInstance.address,
			dappprice:    3,
			volume:       1000,
			tag:          0x0,
			datarestrict: DataInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		dataorder = {
			data:         DataInstance.address,
			dataprice:    3,
			volume:       1000,
			tag:          0x0,
			dapprestrict: DappInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		poolorder = {
			pool:         PoolInstance.address,
			poolprice:    25,
			volume:       3,
			tag:          0x0,
			category:     4,
			trust:        1000,
			dapprestrict: DappInstance.address,
			datarestrict: DataInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		userorder = {
			dapp:         DappInstance.address,
			dappmaxprice: 3,
			data:         DataInstance.address,
			datamaxprice: 1,
			pool:         PoolInstance.address,
			poolmaxprice: 25,
			volume:       1, // CHANGE FOR BOT
			tag:          0x0,
			category:     4,
			trust:        1000,
			requester:    user,
			beneficiary:  user,
			callback:     constants.NULL.ADDRESS,
			params:       "app params",
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		dapporder_hash = odbtools.DappOrderStructHash(dapporder);
		dataorder_hash = odbtools.DataOrderStructHash(dataorder);
		poolorder_hash = odbtools.PoolOrderStructHash(poolorder);
		userorder_hash = odbtools.UserOrderStructHash(userorder);
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dappProvider )).signDappOrder(dapporder);
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dataProvider )).signDataOrder(dataorder);
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(poolScheduler)).signPoolOrder(poolorder);
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user         )).signUserOrder(userorder);
	});

	/***************************************************************************
	 *                            TEST: Dapp cancel                            *
	 ***************************************************************************/
	it("presign dapp order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(dapporder_hash), 0, "Error in dapp order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).cancelDappOrder(dapporder);
			assert.fail("user should not be able to sign dapporder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(dapporder_hash), 0, "Error in dapp order presign");
	});

	it("presign dapp order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(dapporder_hash), 0, "Error in dapp order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dappProvider)).cancelDappOrder(dapporder);
		assert.equal(await IexecClerkInstance.viewConsumed(dapporder_hash), dapporder.volume, "Error in dapp order presign");
	});

	/***************************************************************************
	 *                            TEST: Data cancel                            *
	 ***************************************************************************/
	it("presign data order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(dataorder_hash), 0, "Error in data order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).cancelDataOrder(dataorder);
			assert.fail("user should not be able to sign dataorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(dataorder_hash), 0, "Error in data order presign");
	});

	it("presign data order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(dataorder_hash), 0, "Error in data order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dataProvider)).cancelDataOrder(dataorder);
		assert.equal(await IexecClerkInstance.viewConsumed(dataorder_hash), dataorder.volume, "Error in data order presign");
	});

	/***************************************************************************
	 *                            TEST: Pool cancel                            *
	 ***************************************************************************/
	it("presign pool order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(poolorder_hash), 0, "Error in pool order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).cancelPoolOrder(poolorder);
			assert.fail("user should not be able to sign poolorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(poolorder_hash), 0, "Error in pool order presign");
	});

	it("presign pool order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(poolorder_hash), 0, "Error in pool order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(poolScheduler)).cancelPoolOrder(poolorder);
		assert.equal(await IexecClerkInstance.viewConsumed(poolorder_hash), poolorder.volume, "Error in pool order presign");
	});

	/***************************************************************************
	 *                            TEST: User cancel                            *
	 ***************************************************************************/
	it("presign user order #1", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(userorder_hash), 0, "Error in user order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).cancelUserOrder(userorder);
			assert.fail("user should not be able to sign userorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecClerkInstance.viewConsumed(userorder_hash), 0, "Error in user order presign");
	});

	it("presign user order #2", async () => {
		assert.equal(await IexecClerkInstance.viewConsumed(userorder_hash), 0, "Error in user order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).cancelUserOrder(userorder);
		assert.equal(await IexecClerkInstance.viewConsumed(userorder_hash), userorder.volume, "Error in user order presign");
	});

});
