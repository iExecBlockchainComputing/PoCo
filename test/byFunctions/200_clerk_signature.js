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

var IexecODBLibOrders = artifacts.require("./tools/IexecODBLibOrders.sol");

const ethers    = require('ethers'); // for ABIEncoderV2
const constants = require("../constants");
const odbtools  = require('../../utils/odb-tools');

const wallets   = require('../wallets');

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

	var IexecODBLibOrdersInstance       = null;
	var IexecODBLibOrdersInstanceEthers = null;

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
		IexecHubInstance     = await IexecHub.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		BeaconInstance       = await Beacon.deployed();
		BrokerInstance       = await Broker.deployed();

		IexecODBLibOrdersInstance = await IexecODBLibOrders.deployed();

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           1,
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * For ABIEncoderV2
		 */
		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecHubInstanceEthers   = new ethers.Contract(IexecHubInstance.address,   IexecHub.abi,   jsonRpcProvider);
		IexecClerkInstanceEthers = new ethers.Contract(IexecClerkInstance.address, IexecClerk.abi, jsonRpcProvider);
		BeaconInstanceEthers     = new ethers.Contract(BeaconInstance.address,     Beacon.abi,     jsonRpcProvider);
		BrokerInstanceEthers     = new ethers.Contract(BrokerInstance.address,     Broker.abi,     jsonRpcProvider);

		IexecODBLibOrdersInstanceEthers = new ethers.Contract(
			IexecODBLibOrdersInstance.address,
			IexecODBLibOrdersInstance.abi,
			jsonRpcProvider
		);
	});

	/***************************************************************************
	 *                         TEST: internal methods                          *
	 ***************************************************************************/
	it("check signature mechanism", async () => {
		entry = { hash: web3.utils.soliditySha3({ t: 'bytes32', v: web3.utils.randomHex(32) }) };
		odbtools.signStruct(entry, entry.hash, wallets.addressToPrivate(iexecAdmin));

		assert.isFalse(await IexecClerkInstanceEthers.m_presigned(entry.hash),                                                                                                                 "Error with the validation of signatures");
		assert.isTrue (await IexecClerkInstanceEthers.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(user,                   entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(constants.NULL.ADDRESS, entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             web3.utils.randomHex(32), { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             constants.NULL.BYTES32,   { v: entry.sign.v, r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             entry.hash,               { v: 0,            r: entry.sign.r,             s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: web3.utils.randomHex(32), s: entry.sign.s             }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             entry.hash,               { v: entry.sign.v, r: entry.sign.r,             s: web3.utils.randomHex(32) }), "Error with the validation of signatures");
		assert.isFalse(await IexecClerkInstanceEthers.verify(iexecAdmin,             entry.hash,               constants.NULL.SIGNATURE                                                     ), "Error with the validation of signatures");
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

	/***************************************************************************
	 *                             TEST: Dapp hash                             *
	 ***************************************************************************/
	it("check dapp hash", async () => {
		dapporder = {
			dapp:         DappInstance.address,
			dappprice:    3,
			volume:       1000,
			datarestrict: DataInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		dapporder_hash = odbtools.DappOrderStructHash(dapporder);
		odbtools.signDappOrder(dapporder, wallets.addressToPrivate(dappProvider));

		assert.isTrue(await IexecClerkInstanceEthers.verify(dappProvider, odbtools.DappOrderStructHash(dapporder), dapporder.sign), "Error with the validation of the dapporder signature");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash(dapporder), dapporder_hash, "Check dapporder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: constants.NULL.ADDRESS, dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: 0,                   volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: constants.NULL.ADDRESS, datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: constants.NULL.ADDRESS, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: constants.NULL.ADDRESS, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: constants.NULL.ADDRESS, salt: dapporder.salt,           sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: web3.utils.randomHex(32), sign: dapporder.sign           }), dapporder_hash, "Check dapporder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ dapp: dapporder.dapp,         dappprice: dapporder.dappprice, volume: dapporder.volume,       datarestrict: dapporder.datarestrict, poolrestrict: dapporder.poolrestrict, userrestrict: dapporder.userrestrict, salt: dapporder.salt,           sign: constants.NULL.SIGNATURE }), dapporder_hash, "Check dapporder hash");
	});

	/***************************************************************************
	 *                             TEST: Data hash                             *
	 ***************************************************************************/
	it("check data hash", async () => {
		dataorder = {
			data:         DataInstance.address,
			dataprice:    3,
			volume:       1000,
			dapprestrict: DappInstance.address,
			poolrestrict: PoolInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		dataorder_hash = odbtools.DataOrderStructHash(dataorder);
		odbtools.signDataOrder(dataorder, wallets.addressToPrivate(dataProvider));

		assert.isTrue(await IexecClerkInstanceEthers.verify(dataProvider, odbtools.DataOrderStructHash(dataorder), dataorder.sign), "Error with the validation of the dataorder signature");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash(dataorder), dataorder_hash, "Check dataorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: constants.NULL.ADDRESS, dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: 0,                   volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: constants.NULL.ADDRESS, dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: constants.NULL.ADDRESS, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: constants.NULL.ADDRESS, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: constants.NULL.ADDRESS, salt: dataorder.salt,           sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: web3.utils.randomHex(32), sign: dataorder.sign           }), dataorder_hash, "Check dataorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ data: dataorder.data,         dataprice: dataorder.dataprice, volume: dataorder.volume,       dapprestrict: dataorder.dapprestrict, poolrestrict: dataorder.poolrestrict, userrestrict: dataorder.userrestrict, salt: dataorder.salt,           sign: constants.NULL.SIGNATURE }), dataorder_hash, "Check dataorder hash");
	});

	/***************************************************************************
	 *                             TEST: Pool hash                             *
	 ***************************************************************************/
	it("check pool hash", async () => {
		poolorder = {
			pool:         PoolInstance.address,
			poolprice:    25,
			volume:       3,
			category:     4,
			trust:        1000,
			tag:          0,
			dapprestrict: DappInstance.address,
			datarestrict: DataInstance.address,
			userrestrict: user,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		poolorder_hash = odbtools.PoolOrderStructHash(poolorder);
		odbtools.signPoolOrder(poolorder, wallets.addressToPrivate(poolScheduler));

		assert.isTrue(await IexecClerkInstanceEthers.verify(poolScheduler, odbtools.PoolOrderStructHash(poolorder), poolorder.sign), "Error with the validation of the poolorder signature");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash(poolorder), poolorder_hash, "Check poolorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: constants.NULL.ADDRESS, poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: 0,                   volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: 1000,             category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: 5,                  trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: 1,             dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: constants.NULL.ADDRESS, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: constants.NULL.ADDRESS, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: constants.NULL.ADDRESS, salt: poolorder.salt,           sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: web3.utils.randomHex(32), sign: poolorder.sign           }), poolorder_hash, "Check poolorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ pool: poolorder.pool,         poolprice: poolorder.poolprice, volume: poolorder.volume, category: poolorder.category, trust: poolorder.trust, tag: poolorder.tag, dapprestrict: poolorder.dapprestrict, datarestrict: poolorder.datarestrict, userrestrict: poolorder.userrestrict, salt: poolorder.salt,           sign: constants.NULL.SIGNATURE }), poolorder_hash, "Check poolorder hash");
	});

	/***************************************************************************
	 *                             TEST: User hash                             *
	 ***************************************************************************/
	it("check user hash", async () => {
		userorder = {
			dapp:         DappInstance.address,
			dappmaxprice: 3,
			data:         DataInstance.address,
			datamaxprice: 1,
			pool:         PoolInstance.address,
			poolmaxprice: 25,
			volume:       1, // CHANGE FOR BOT
			category:     4,
			trust:        1000,
			tag:          0,
			requester:    user,
			beneficiary:  user,
			callback:     constants.NULL.ADDRESS,
			params:       "app params",
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		userorder_hash = odbtools.UserOrderStructHash(userorder);
		odbtools.signUserOrder(userorder, wallets.addressToPrivate(user));

		assert.isTrue(await IexecClerkInstanceEthers.verify(user, odbtools.UserOrderStructHash(userorder), userorder.sign), "Error with the validation of the userorder signature");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash(userorder), userorder_hash, "Check userorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: constants.NULL.ADDRESS, dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: 1000,                   data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: constants.NULL.ADDRESS, datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: 1000,                   pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: constants.NULL.ADDRESS, poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: 1000,                   volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: 10,               category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: 3,                  trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: 0,               tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: 1,             requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: constants.NULL.ADDRESS, beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: constants.NULL.ADDRESS, callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: user,               params: userorder.params, salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: "wrong params",   salt: userorder.salt,           sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.notEqual(await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: web3.utils.randomHex(32), sign: userorder.sign           }), userorder_hash, "Check userorder hash");
		// assert.equal   (await IexecODBLibOrdersInstanceEthers.hash({ dapp: userorder.dapp,         dappmaxprice: userorder.dappmaxprice, data: userorder.data,         datamaxprice: userorder.datamaxprice, pool: userorder.pool,         poolmaxprice: userorder.poolmaxprice, volume: userorder.volume, category: userorder.category, trust: userorder.trust, tag: userorder.tag, requester: userorder.requester,    beneficiary: userorder.beneficiary,  callback: userorder.callback, params: userorder.params, salt: userorder.salt,           sign: constants.NULL.SIGNATURE }), userorder_hash, "Check userorder hash");
	});



});
