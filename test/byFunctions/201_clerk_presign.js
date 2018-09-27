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

const wallets   = require('./wallets');

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

	var jsonRpcProvider          = null;
	var IexecHubInstanceEthers   = null;
	var IexecClerkInstanceEthers = null;
	var BeaconInstanceEthers     = null;
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
		BeaconInstance       = await Beacon.deployed();
		BrokerInstance       = await Broker.deployed();

		/**
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,           jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerkInstance.abi, jsonRpcProvider);
		BeaconInstanceEthers     = new ethers.Contract(BeaconInstance.address,     BeaconInstance.abi,     jsonRpcProvider);
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
			//market
			dapp:         DappInstance.address,
			dappprice:    3,
			volume:       1000,
			// restrict
			datarestrict: DataInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			// extra
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		dataorder = {
			//market
			data:         DataInstance.address,
			dataprice:    3,
			volume:       1000,
			// restrict
			dapprestrict: DappInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			// extra
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		poolorder = {
			// market
			pool:         PoolInstance.address,
			poolprice:    25,
			volume:       3,
			// settings
			category:     4,
			trust:        1000,
			tag:          0,
			// restrict
			dapprestrict: DappInstance.address,
			datarestrict: DataInstance.address,
			userrestrict: user,
			// extra
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		userorder = {
			// market
			dapp:         DappInstance.address,
			dappmaxprice: 3,
			data:         DataInstance.address,
			datamaxprice: 1,
			pool:         PoolInstance.address,
			poolmaxprice: 25,
			volume:       1, // CHANGE FOR BOT
			// settings
			category:     4,
			trust:        1000,
			tag:          0,
			requester:    user,
			beneficiary:  user,
			callback:     constants.NULL.ADDRESS,
			params:       "app params",
			// extra
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE
		};
		dapporder_hash = odbtools.getFullHash(IexecClerkInstance.address, odbtools.dappPartialHash(dapporder), dapporder.salt);
		dataorder_hash = odbtools.getFullHash(IexecClerkInstance.address, odbtools.dataPartialHash(dataorder), dataorder.salt);
		poolorder_hash = odbtools.getFullHash(IexecClerkInstance.address, odbtools.poolPartialHash(poolorder), poolorder.salt);
		userorder_hash = odbtools.getFullHash(IexecClerkInstance.address, odbtools.userPartialHash(userorder), userorder.salt);
	});

	/***************************************************************************
	 *                             TEST: Dapp sign                             *
	 ***************************************************************************/
	it("presign dapp order #1", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(dapporder_hash), "Error in dapp order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).signDappOrder(dapporder);
			assert.fail("user should not be able to sign dapporder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.isFalse(await IexecClerkInstance.m_presigned(dapporder_hash), "Error in dapp order presign");
	});

	it("presign dapp order #2", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(dapporder_hash), "Error in dapp order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dappProvider)).signDappOrder(dapporder);
		assert.isTrue (await IexecClerkInstance.m_presigned(dapporder_hash), "Error in dapp order presign");
	});

	/***************************************************************************
	 *                             TEST: Data sign                             *
	 ***************************************************************************/
	it("presign data order #1", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(dataorder_hash), "Error in data order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).signDataOrder(dataorder);
			assert.fail("user should not be able to sign dataorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.isFalse(await IexecClerkInstance.m_presigned(dataorder_hash), "Error in data order presign");
	});

	it("presign data order #2", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(dataorder_hash), "Error in data order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(dataProvider)).signDataOrder(dataorder);
		assert.isTrue (await IexecClerkInstance.m_presigned(dataorder_hash), "Error in data order presign");
	});

	/***************************************************************************
	 *                             TEST: Pool sign                             *
	 ***************************************************************************/
	it("presign pool order #1", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(poolorder_hash), "Error in pool order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).signPoolOrder(poolorder);
			assert.fail("user should not be able to sign poolorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.isFalse(await IexecClerkInstance.m_presigned(poolorder_hash), "Error in pool order presign");
	});

	it("presign pool order #2", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(poolorder_hash), "Error in dapp order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(poolScheduler)).signPoolOrder(poolorder);
		assert.isTrue (await IexecClerkInstance.m_presigned(poolorder_hash), "Error in dapp order presign");
	});

	/***************************************************************************
	 *                             TEST: User sign                             *
	 ***************************************************************************/
	it("presign user order #1", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(userorder_hash), "Error in user order presign");
		try
		{
			await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(iexecAdmin)).signUserOrder(userorder);
			assert.fail("user should not be able to sign userorder");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.startsWith("VM Exception while processing transaction: revert"), "Expected an error starting with 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.isFalse(await IexecClerkInstance.m_presigned(userorder_hash), "Error in user order presign");
	});

	it("presign user order #2", async () => {
		assert.isFalse(await IexecClerkInstance.m_presigned(userorder_hash), "Error in dapp order presign");
		await IexecClerkInstanceEthers.connect(jsonRpcProvider.getSigner(user)).signUserOrder(userorder);
		assert.isTrue (await IexecClerkInstance.m_presigned(userorder_hash), "Error in dapp order presign");
	});



});
