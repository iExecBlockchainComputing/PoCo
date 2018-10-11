let types = {
	EIP712Domain: [
		{ name: "name",              type: "string"  },
		{ name: "version",           type: "string"  },
		{ name: "chainId",           type: "uint256" },
		{ name: "verifyingContract", type: "address" },
	],
	DappOrder: [
		{ name: "dapp",         type: "address" },
		{ name: "dappprice",    type: "uint256" },
		{ name: "volume",       type: "uint256" },
		{ name: "datarestrict", type: "address" },
		{ name: "poolrestrict", type: "address" },
		{ name: "userrestrict", type: "address" },
		{ name: "salt",         type: "bytes32" }
	],
	DataOrder: [
		{ name: "data",         type: "address" },
		{ name: "dataprice",    type: "uint256" },
		{ name: "volume",       type: "uint256" },
		{ name: "dapprestrict", type: "address" },
		{ name: "poolrestrict", type: "address" },
		{ name: "userrestrict", type: "address" },
		{ name: "salt",         type: "bytes32" }
	],
	PoolOrder: [
		{ name: "pool",         type: "address" },
		{ name: "poolprice",    type: "uint256" },
		{ name: "volume",       type: "uint256" },
		{ name: "category",     type: "uint256" },
		{ name: "trust",        type: "uint256" },
		{ name: "tag",          type: "uint256" },
		{ name: "dapprestrict", type: "address" },
		{ name: "datarestrict", type: "address" },
		{ name: "userrestrict", type: "address" },
		{ name: "salt",         type: "bytes32" }
	],
	UserOrder: [
		{ name: "dapp",         type: "address" },
		{ name: "dappmaxprice", type: "uint256" },
		{ name: "data",         type: "address" },
		{ name: "datamaxprice", type: "uint256" },
		{ name: "pool",         type: "address" },
		{ name: "poolmaxprice", type: "uint256" },
		{ name: "requester",    type: "address" },
		{ name: "volume",       type: "uint256" },
		{ name: "category",     type: "uint256" },
		{ name: "trust",        type: "uint256" },
		{ name: "tag",          type: "uint256" },
		{ name: "beneficiary",  type: "address" },
		{ name: "callback",     type: "address" },
		{ name: "params",       type: "string"  },
		{ name: "salt",         type: "bytes32" }
	],
}

function dependencies(primaryType, found = [])
{
	if (found.includes(primaryType))
		return found;
	if (types[primaryType] === undefined)
		return found;
	found.push(primaryType);
	for (let field of types[primaryType])
		for (let dep of dependencies(field.type, found))
			if (!found.includes(dep))
				found.push(dep);
	return found;
}

function encodeType(primaryType)
{
	// Get dependencies primary first, then alphabetical
	let deps = dependencies(primaryType);
	deps = deps.filter(t => t != primaryType);
	deps = [primaryType].concat(deps.sort());

	// Format as a string with fields
	let result = "";
	for (let type of deps)
	{
			result += `${type}(${types[type].map(({ name, type }) => `${type} ${name}`).join(",")})`;
	}
	return result;
}

function typeHash(primaryType)
{
	return ethUtil.sha3(encodeType(primaryType));
}

function encodeData(primaryType, data)
{
	let encTypes  = [];
	let encValues = [];
	// Add typehash
	encTypes.push("bytes32");
	encValues.push(typeHash(primaryType));
	// Add field contents
	for (let field of types[primaryType])
	{
			let value = data[field.name];
			if (field.type == "string" || field.type == "bytes")
			{
					encTypes.push("bytes32");
					value = ethUtil.sha3(value);
					encValues.push(value);
			}
			else if (types[field.type] !== undefined)
			{
					encTypes.push("bytes32");
					value = ethUtil.sha3(encodeData(field.type, value));
					encValues.push(value);
			}
			else if (field.type.lastIndexOf("]") === field.type.length - 1)
			{
					throw "TODO: Arrays currently unimplemented in encodeData";
			}
			else
			{
					encTypes.push(field.type);
					encValues.push(value);
			}
	}
	// console.log(">>1", encTypes);
	// console.log(">>2", encValues);
	return abi.rawEncode(encTypes, encValues);
}

function structHash(primaryType, data)
{
	return ethUtil.sha3(encodeData(primaryType, data));
}

function signHash()
{
	return ethUtil.sha3(
		Buffer.concat([
			Buffer.from("1901", "hex"),
			structHash("EIP712Domain", typedData.domain),
			structHash(typedData.primaryType, typedData.message),
		]),
	);
}















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

var IexecODBLibOrders = artifacts.require("./IexecODBLibOrders.sol");
var TestContract      = artifacts.require("./TestContract.sol");

const ethers    = require("ethers"); // for ABIEncoderV2
const constants = require("./constants");
const odbtools  = require("../utils/odb-tools");

const wallets   = require("./wallets");

const ethUtil   = require("ethereumjs-util");
const abi       = require("ethereumjs-abi");


var RLCInstance          = null;
var IexecHubInstance     = null;
var IexecClerkInstance   = null;
var DappRegistryInstance = null;
var DataRegistryInstance = null;
var PoolRegistryInstance = null;
var BeaconInstance       = null;
var BrokerInstance       = null;
var DappInstance         = null;
var DataInstance         = null;
var PoolInstance         = null;
var TestInstance         = null;
var TestEthersInstance   = null;

var domain    = null;
var dapporder = null;
var dataorder = null;
var poolorder = null;
var userorder = null;

function extractEvents(txMined, address, name) { return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name }); }

contract("IexecHub", async (accounts) => {

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

	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		RLCInstance          = await RLC.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		BeaconInstance       = await Beacon.deployed();
		BrokerInstance       = await Broker.deployed();

		TestInstance              = await TestContract.deployed();
		IexecODBLibOrdersInstance = await IexecODBLibOrders.deployed()

		jsonRpcProvider                 = new ethers.providers.JsonRpcProvider();
		TestEthersInstance              = new ethers.Contract(TestInstance.address,              TestContract.abi,      jsonRpcProvider);
		IexecODBLibOrdersEthersInstance = new ethers.Contract(IexecODBLibOrdersInstance.address, IexecODBLibOrders.abi, jsonRpcProvider);
	});

	it("initiate resources", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);

		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);

		txMined = await PoolRegistryInstance.createPool(poolScheduler, "A test workerpool", 10, 10, 10, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);
	});

	it("write orders", async () => {
		domain = {
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: TestInstance.address,
		};
		dapporder = {
			dapp:         DappInstance.address,
			dappprice:    3,
			volume:       1000,
			datarestrict: constants.NULL.ADDRESS,
			poolrestrict: constants.NULL.ADDRESS,
			userrestrict: constants.NULL.ADDRESS,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		dataorder = {
			data:         DataInstance.address,
			dataprice:    1,
			volume:       1000,
			dapprestrict: constants.NULL.ADDRESS,
			poolrestrict: constants.NULL.ADDRESS,
			userrestrict: constants.NULL.ADDRESS,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
		poolorder = {
			pool:         PoolInstance.address,
			poolprice:    25,
			volume:       3,
			category:     4,
			trust:        1000,
			tag:          0,
			dapprestrict: constants.NULL.ADDRESS,
			datarestrict: constants.NULL.ADDRESS,
			userrestrict: constants.NULL.ADDRESS,
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		}
		userorder = {
			dapp:         DappInstance.address,
			dappmaxprice: 3,
			data:         DataInstance.address,
			datamaxprice: 1,
			pool:         constants.NULL.ADDRESS,
			poolmaxprice: 25,
			volume:       1,
			category:     4,
			trust:        1000,
			tag:          0,
			requester:    user,
			beneficiary:  user,
			callback:     constants.NULL.ADDRESS,
			params:       "<parameters>",
			salt:         web3.utils.randomHex(32),
			sign:         constants.NULL.SIGNATURE,
		};
	});

	it("compute type hashes", async () => {
		assert.equal(encodeType("EIP712Domain"), "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",                                                                                                                                                                           "[ERROR] domain type encode"   );
		assert.equal(encodeType("DappOrder"   ), "DappOrder(address dapp,uint256 dappprice,uint256 volume,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)",                                                                                                                         "[ERROR] dapporder type encode");
		assert.equal(encodeType("DataOrder"   ), "DataOrder(address data,uint256 dataprice,uint256 volume,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)",                                                                                                                         "[ERROR] dataorder type encode");
		assert.equal(encodeType("PoolOrder"   ), "PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)",                                                                              "[ERROR] poolorder type encode");
		assert.equal(encodeType("UserOrder"   ), "UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)", "[ERROR] userorder type encode");

		assert.equal(ethUtil.bufferToHex(typeHash("EIP712Domain")), odbtools.EIP712DOMAIN_TYPEHASH, "[ERROR] domain type hash"   );
		assert.equal(ethUtil.bufferToHex(typeHash("DappOrder"   )), odbtools.DAPPORDER_TYPEHASH,    "[ERROR] dapporder type hash");
		assert.equal(ethUtil.bufferToHex(typeHash("DataOrder"   )), odbtools.DATAORDER_TYPEHASH,    "[ERROR] dataorder type hash");
		assert.equal(ethUtil.bufferToHex(typeHash("PoolOrder"   )), odbtools.POOLORDER_TYPEHASH,    "[ERROR] poolorder type hash");
		assert.equal(ethUtil.bufferToHex(typeHash("UserOrder"   )), odbtools.USERORDER_TYPEHASH,    "[ERROR] userorder type hash");

		assert.equal(await IexecODBLibOrdersInstance.EIP712DOMAIN_TYPEHASH(), odbtools.EIP712DOMAIN_TYPEHASH, "[ERROR] domain type hash (SC)"   );
		assert.equal(await IexecODBLibOrdersInstance.DAPPORDER_TYPEHASH(),    odbtools.DAPPORDER_TYPEHASH,    "[ERROR] dapporder type hash (SC)");
		assert.equal(await IexecODBLibOrdersInstance.DATAORDER_TYPEHASH(),    odbtools.DATAORDER_TYPEHASH,    "[ERROR] dataorder type hash (SC)");
		assert.equal(await IexecODBLibOrdersInstance.POOLORDER_TYPEHASH(),    odbtools.POOLORDER_TYPEHASH,    "[ERROR] poolorder type hash (SC)");
		assert.equal(await IexecODBLibOrdersInstance.USERORDER_TYPEHASH(),    odbtools.USERORDER_TYPEHASH,    "[ERROR] userorder type hash (SC)");

		console.log("EIP712DOMAIN_TYPEHASH:", odbtools.EIP712DOMAIN_TYPEHASH);
		console.log("DAPPORDER_TYPEHASH:   ", odbtools.DAPPORDER_TYPEHASH   );
		console.log("DATAORDER_TYPEHASH:   ", odbtools.DATAORDER_TYPEHASH   );
		console.log("POOLORDER_TYPEHASH:   ", odbtools.POOLORDER_TYPEHASH   );
		console.log("USERORDER_TYPEHASH:   ", odbtools.USERORDER_TYPEHASH   );
	});

	it("domain hash", async () => {
		console.log("[domain hash] ref:", ethUtil.bufferToHex(structHash("EIP712Domain", domain)));
		console.log("[domain hash] js: ", odbtools.DomainStructHash(domain)                      );
		console.log("[domain hash] sc: ", await TestInstance.EIP712DOMAIN_SEPARATOR()            );

		odbtools.setup(domain);
	});

	it("dapporder hash", async () => {
		console.log("[dapporder hash] ref:", ethUtil.bufferToHex(structHash("DappOrder", dapporder)));
		console.log("[dapporder hash] js: ", odbtools.DappOrderStructHash(dapporder));
		console.log("[dapporder hash] sc: ", await TestEthersInstance.getDappOrderHash(dapporder));
	});

	it("dataorder hash", async () => {
		console.log("[dataorder hash] ref:", ethUtil.bufferToHex(structHash("DataOrder", dataorder)));
		console.log("[dataorder hash] js: ", odbtools.DataOrderStructHash(dataorder));
		console.log("[dataorder hash] sc: ", await TestEthersInstance.getDataOrderHash(dataorder));
	});

	it("poolorder hash", async () => {
		console.log("[poolorder hash] ref:", ethUtil.bufferToHex(structHash("PoolOrder", poolorder)));
		console.log("[poolorder hash] js: ", odbtools.PoolOrderStructHash(poolorder));
		console.log("[poolorder hash] sc: ", await TestEthersInstance.getPoolOrderHash(poolorder));
	});

	it("userorder hash", async () => {
		console.log("[userorder hash] ref:", ethUtil.bufferToHex(structHash("UserOrder", userorder)));
		console.log("[userorder hash] js: ", odbtools.UserOrderStructHash(userorder));
		console.log("[userorder hash] sc: ", await TestEthersInstance.getUserOrderHash(userorder));
	});

	it("signature", async () => {

		odbtools.signDappOrder(dapporder, wallets.addressToPrivate(dappProvider ));
		odbtools.signDataOrder(dataorder, wallets.addressToPrivate(dataProvider ));
		odbtools.signPoolOrder(poolorder, wallets.addressToPrivate(poolScheduler));
		odbtools.signUserOrder(userorder, wallets.addressToPrivate(user         ));

		assert(await TestEthersInstance.checkDappOrder(dapporder), "[ERROR] invalid dapporder signature");
		assert(await TestEthersInstance.checkDataOrder(dataorder), "[ERROR] invalid dataorder signature");
		assert(await TestEthersInstance.checkPoolOrder(poolorder), "[ERROR] invalid poolorder signature");
		assert(await TestEthersInstance.checkUserOrder(userorder), "[ERROR] invalid userorder signature");

	});



});
