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

const constants = require("../constants");

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

	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;

	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		IexecClerkInstance   = await IexecClerk.at("0xBfBfD8ABc99fA00Ead2C46879A7D06011CbA73c5");
		IexecHubInstance     = await IexecHub.at(await IexecClerkInstance.iexechub());
		DappRegistryInstance = await DappRegistry.at(await IexecHubInstance.dappregistry());
		DataRegistryInstance = await DataRegistry.at(await IexecHubInstance.dataregistry());
		PoolRegistryInstance = await PoolRegistry.at(await IexecHubInstance.poolregistry());
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Dapp Creation", async () => {
		var dappaddress = await DappRegistryInstance.viewEntry(dappProvider, 1);
		if (dappaddress == constants.NULL.ADDRESS)
		{
			txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
			dappaddress = events[0].args.dapp;
		}
		console.log("[Dapp]");
		console.log("address:", dappaddress);
		console.log("owner:", dappProvider);
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Data Creation", async () => {
		var dataaddress = await DataRegistryInstance.viewEntry(dataProvider, 1);
		if (dataaddress == constants.NULL.ADDRESS)
		{
			txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
			dataaddress = events[0].args.data;
		}
		console.log("[Data]");
		console.log("address:", dataaddress);
		console.log("owner:", dataProvider);
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("[Genesis] Pool Creation", async () => {
		var pooladdress = await PoolRegistryInstance.viewEntry(poolScheduler, 1);
		if (pooladdress == constants.NULL.ADDRESS)
		{
			txMined = await PoolRegistryInstance.createPool(
				poolScheduler,
				"A test workerpool",
				10, // lock
				10, // minimum stake
				10, // minimum score
				{ from: poolScheduler }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
			pooladdress = events[0].args.pool;
		}
		console.log("[Pool]");
		console.log("address:", pooladdress);
		console.log("owner:", poolScheduler);
	});

});
